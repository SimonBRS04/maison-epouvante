import { randomUUID } from 'node:crypto';
import net from 'node:net';
import confluent from '@confluentinc/kafka-javascript';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { TOPIC_PARTITIONS } from '../src/adapters/kafka.js';
import { MAX_DELIVERIES } from '../src/deliveries.js';
import { createPublisher, createSubscriber } from '../src/index.js';

const { Kafka, logLevel } = confluent.KafkaJS;
const BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
// Joining a consumer group takes a few seconds (the broker waits for other members).
const WAIT = { timeout: 20_000, interval: 100 };

// Skipped, not failed, when no broker answers (as in CI).
const brokerUp = await isReachable('localhost', 9092);

describe('kafka adapter without a broker', () => {
  it('rejects when the broker is unreachable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const attempt = createPublisher({
      broker: 'kafka',
      brokers: '127.0.0.1:1',
      retry: { retries: 0 },
    });
    await expect(attempt).rejects.toThrow(/Kafka unreachable/);
  }, 30_000);
});

describe.skipIf(!brokerUp)('kafka adapter against a real broker', { timeout: 60_000 }, () => {
  const kafka = new Kafka({ kafkaJS: { brokers: [BROKERS], logLevel: logLevel.NOTHING } });
  const opened = [];
  const topics = [];

  /** A fresh topic per test, so that offsets and leftovers never leak between tests. */
  function newTopic() {
    const topic = `test-${randomUUID().slice(0, 8)}`;
    topics.push(topic);
    return topic;
  }

  async function subscriber(topic, group, handler, options = {}) {
    const sub = await createSubscriber({ broker: 'kafka', group, ...options });
    opened.push(sub);
    topics.push(`${topic}.${group}.rejets`);
    await sub.subscribe(topic, handler);
    return sub;
  }

  async function publisher(options = {}) {
    const pub = await createPublisher({ broker: 'kafka', ...options });
    opened.push(pub);
    return pub;
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.allSettled(opened.splice(0).map((client) => client.close()));
  });

  afterAll(async () => {
    const admin = kafka.admin();
    await admin.connect();
    const existing = await admin.listTopics();
    // Deduplicated: deleting the same topic twice fails the whole request.
    await admin.deleteTopics({ topics: [...new Set(topics)].filter((t) => existing.includes(t)) });
    await admin.disconnect();
  });

  it(`creates the topic with ${TOPIC_PARTITIONS} partitions on first use`, async () => {
    const topic = newTopic();
    await (await publisher()).publish(topic, { id: 'e-1' });

    const admin = kafka.admin();
    await admin.connect();
    const described = await admin.fetchTopicMetadata({ topics: [topic] });
    await admin.disconnect();
    expect(described[0].partitions).toHaveLength(TOPIC_PARTITIONS);
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
    }, WAIT);
  });

  it('shares the partitions between consumers of the same group', async () => {
    const topic = newTopic();
    const first = vi.fn();
    const second = vi.fn();
    await subscriber(topic, 'g', first);
    await subscriber(topic, 'g', second);
    const pub = await publisher();

    // Distinct keys spread the messages over the partitions.
    for (let n = 0; n < 30; n += 1) await pub.publish(topic, { n }, { key: `m-${n}` });

    await vi.waitFor(() => {
      expect(first.mock.calls.length + second.mock.calls.length).toBe(30);
    }, WAIT);
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it('keeps the order of the messages of one key', async () => {
    const topic = newTopic();
    const finished = [];
    await subscriber(topic, 'g', async ({ seq }) => {
      // Later messages finish faster: concurrent handling would reorder them.
      await new Promise((resolve) => setTimeout(resolve, (5 - seq) * 10));
      finished.push(seq);
    });
    const pub = await publisher();

    for (let seq = 1; seq <= 5; seq += 1) await pub.publish(topic, { seq }, { key: 'm-001' });

    await vi.waitFor(() => expect(finished).toEqual([1, 2, 3, 4, 5]), WAIT);
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

    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(3), WAIT);
  });

  it('sets a message aside after the last failed attempt instead of retrying forever', async () => {
    const topic = newTopic();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = vi.fn(async () => {
      throw new Error('always fails');
    });
    await subscriber(topic, 'g', handler);

    await (await publisher()).publish(topic, { id: 'e-poison' });

    const parked = vi.fn();
    await subscriber(`${topic}.g.rejets`, 'probe', parked, { fromBeginning: true });
    await vi.waitFor(() => expect(parked).toHaveBeenCalledWith({ id: 'e-poison' }), WAIT);
    expect(handler).toHaveBeenCalledTimes(MAX_DELIVERIES);
  });

  it('replays the topic for a new group only with fromBeginning', async () => {
    const topic = newTopic();
    const pub = await publisher();
    await pub.publish(topic, { id: 'before' });

    const replay = vi.fn();
    const live = vi.fn();
    await subscriber(topic, 'replay', replay, { fromBeginning: true });
    await subscriber(topic, 'live', live);
    await pub.publish(topic, { id: 'after' });

    await vi.waitFor(() => {
      expect(replay.mock.calls).toEqual([[{ id: 'before' }], [{ id: 'after' }]]);
      expect(live).toHaveBeenCalledWith({ id: 'after' });
    }, WAIT);
    expect(live).not.toHaveBeenCalledWith({ id: 'before' });
  });

  it('publishes with the idempotent producer in secure mode', async () => {
    const topic = newTopic();
    const handler = vi.fn();
    await subscriber(topic, 'g', handler);

    await (await publisher({ secure: true })).publish(topic, { id: 'secure' });

    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith({ id: 'secure' }), WAIT);
  });
});

function isReachable(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 300 });
    socket.once('connect', () => resolve(true) || socket.destroy());
    socket.once('timeout', () => resolve(false) || socket.destroy());
    socket.once('error', () => resolve(false));
  });
}
