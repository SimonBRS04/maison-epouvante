import { randomUUID } from 'node:crypto';
import net from 'node:net';
import amqp from 'amqplib';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_DELIVERIES } from '../src/deliveries.js';
import { createPublisher, createSubscriber } from '../src/index.js';

const URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
const MANAGEMENT_URL = 'http://localhost:15672/api';
const FAST_RECOVERY = { initialDelay: 100, maxDelay: 200, maxRetries: 20 };

// Skipped, not failed, when no broker answers (as in CI).
const brokerUp = await isReachable('localhost', 5672);

describe('rabbitmq adapter without a broker', () => {
  it('rejects when the broker is unreachable, without leaking the password', async () => {
    const attempt = createPublisher({
      broker: 'rabbitmq',
      url: 'amqp://someone:s3cret@127.0.0.1:1',
      recovery: { initialDelay: 10, maxRetries: 1 },
    });
    await expect(attempt).rejects.toThrow(/RabbitMQ unreachable/);
    await expect(attempt).rejects.not.toThrow(/s3cret/);
  });
});

describe.skipIf(!brokerUp)('rabbitmq adapter against a real broker', () => {
  const opened = [];
  const topics = [];
  const queues = [];

  /** A fresh topic per test: queues are durable and would leak messages between tests. */
  function newTopic() {
    const topic = `test-${randomUUID().slice(0, 8)}`;
    topics.push(topic);
    return topic;
  }

  async function subscriber(topic, group, handler, options = {}) {
    const sub = await createSubscriber({
      broker: 'rabbitmq',
      group,
      recovery: FAST_RECOVERY,
      ...options,
    });
    opened.push(sub);
    queues.push(`${topic}.${group}`, `${topic}.${group}.rejets`);
    await sub.subscribe(topic, handler);
    return sub;
  }

  async function publisher(options = {}) {
    const pub = await createPublisher({ broker: 'rabbitmq', recovery: FAST_RECOVERY, ...options });
    opened.push(pub);
    return pub;
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.allSettled(opened.splice(0).map((client) => client.close()));
  });

  afterAll(async () => {
    const connection = await amqp.connect(URL);
    const channel = await connection.createChannel();
    for (const queue of queues) await channel.deleteQueue(queue);
    for (const topic of topics) await channel.deleteExchange(topic);
    await connection.close();
  });

  it('delivers a copy of the message to each group', async () => {
    const topic = newTopic();
    const receivedA = vi.fn();
    const receivedB = vi.fn();
    await subscriber(topic, 'a', receivedA);
    await subscriber(topic, 'b', receivedB);

    await (await publisher()).publish(topic, { id: 'e-1' }, { key: 'm-001' });

    await vi.waitFor(() => {
      expect(receivedA).toHaveBeenCalledWith({ id: 'e-1' });
      expect(receivedB).toHaveBeenCalledWith({ id: 'e-1' });
    });
  });

  it('shares messages between consumers of the same group', async () => {
    const topic = newTopic();
    const first = vi.fn();
    const second = vi.fn();
    await subscriber(topic, 'g', first);
    await subscriber(topic, 'g', second);
    const pub = await publisher();

    await pub.publish(topic, { id: 'e-1' });
    await pub.publish(topic, { id: 'e-2' });

    await vi.waitFor(() => {
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  it('redelivers a message whose handler fails', async () => {
    const topic = newTopic();
    let attempts = 0;
    const handler = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('simulated failure');
    });
    await subscriber(topic, 'g', handler);

    await (await publisher()).publish(topic, { id: 'e-1' });

    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(3));
  });

  it('sets a message aside after the last failed attempt instead of retrying forever', async () => {
    const topic = newTopic();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = vi.fn(async () => {
      throw new Error('always fails');
    });
    await subscriber(topic, 'g', handler);

    await (await publisher()).publish(topic, { id: 'e-poison' });

    const probe = await amqp.connect(URL);
    const channel = await probe.createChannel();
    let parked;
    await vi.waitFor(async () => {
      parked = await channel.get(`${topic}.g.rejets`, { noAck: true });
      expect(parked).toBeTruthy();
    });
    expect(JSON.parse(parked.content)).toEqual({ id: 'e-poison' });
    expect(handler).toHaveBeenCalledTimes(MAX_DELIVERIES);
    await probe.close();
  });

  it('handles the messages of one subscriber one at a time, in order', async () => {
    const topic = newTopic();
    const finished = [];
    await subscriber(topic, 'g', async ({ seq }) => {
      // Later messages finish faster: concurrent handling would reorder them.
      await new Promise((resolve) => setTimeout(resolve, (5 - seq) * 10));
      finished.push(seq);
    });
    const pub = await publisher();

    for (let seq = 1; seq <= 5; seq += 1) await pub.publish(topic, { seq });

    await vi.waitFor(() => expect(finished).toEqual([1, 2, 3, 4, 5]));
  });

  it('keeps at most one unacknowledged message per consumer by default', async () => {
    const topic = newTopic();
    await subscriber(topic, 'default', vi.fn());
    await subscriber(topic, 'wider', vi.fn(), { prefetch: 10 });

    await vi.waitFor(async () => {
      const consumers = await (await management('/consumers')).json();
      const prefetchOf = (group) =>
        consumers.find((c) => c.queue.name === `${topic}.${group}`)?.prefetch_count;
      expect([prefetchOf('default'), prefetchOf('wider')]).toEqual([1, 10]);
    }, WAIT);
  });

  it('marks messages persistent only in secure mode', async () => {
    const topic = newTopic();
    const probe = await amqp.connect(URL);
    const channel = await probe.createChannel();
    await channel.assertExchange(topic, 'topic', { durable: true });
    const { queue } = await channel.assertQueue('', { exclusive: true });
    await channel.bindQueue(queue, topic, '#');

    await (await publisher()).publish(topic, { id: 'default' });
    await (await publisher({ secure: true })).publish(topic, { id: 'secure' });

    const modes = {};
    await vi.waitFor(async () => {
      const message = await channel.get(queue, { noAck: true });
      if (message) modes[JSON.parse(message.content).id] = message.properties.deliveryMode;
      expect(Object.keys(modes)).toHaveLength(2);
    });
    // 1 = transient (lost if the broker restarts), 2 = persistent (written to disk).
    expect(modes).toEqual({ default: 1, secure: 2 });
    await probe.close();
  });

  it('reconnects and resumes after the broker drops the connections', async () => {
    // The management API lists connections a few seconds late: wait for a clean slate so
    // that only this test's two connections get dropped.
    await vi.waitFor(async () => expect(await ownConnections()).toHaveLength(0), WAIT);
    const topic = newTopic();
    const handler = vi.fn();
    await subscriber(topic, 'g', handler);
    const pub = await publisher();
    await pub.publish(topic, { id: 'before' });
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));

    let own = [];
    await vi.waitFor(async () => {
      own = await ownConnections();
      expect(own).toHaveLength(2);
    }, WAIT);
    for (const { name } of own) {
      const res = await management(`/connections/${encodeURIComponent(name)}`, 'DELETE');
      expect(res.status).toBe(204);
    }
    await pub.publish(topic, { id: 'after' });

    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith({ id: 'after' }), WAIT);
  }, 40_000);
});

const WAIT = { timeout: 15_000, interval: 250 };

async function ownConnections() {
  const connections = await (await management('/connections')).json();
  return connections.filter((c) =>
    c.client_properties?.connection_name?.endsWith(`(pid ${process.pid})`),
  );
}

function management(path, method = 'GET') {
  const authorization = `Basic ${Buffer.from('guest:guest').toString('base64')}`;
  return fetch(`${MANAGEMENT_URL}${path}`, { method, headers: { authorization } });
}

function isReachable(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 300 });
    socket.once('connect', () => resolve(true) || socket.destroy());
    socket.once('timeout', () => resolve(false) || socket.destroy());
    socket.once('error', () => resolve(false));
  });
}
