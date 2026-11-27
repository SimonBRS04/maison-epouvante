/** `rabbitmq` adapter (amqplib). Topology, settings and behaviour: see this module's README. */
import amqp from 'amqplib';
import { MAX_DELIVERIES } from '../deliveries.js';

const DEFAULT_URL = 'amqp://guest:guest@localhost:5672';

// amqplib's own recovery, as in production: 1, 2, 4, 8, 8 s (about 23 s) outlives the
// benchmark's 10 s outage plus the broker's boot. No jitter, so runs stay reproducible.
const RECOVERY_POLICY = { initialDelay: 1000, factor: 2, maxDelay: 8000, jitter: 0, maxRetries: 5 };

/**
 * Creates a publisher on RabbitMQ.
 * @param {object} [options]
 * @param {string} [options.url] AMQP URL (defaults to RABBITMQ_URL).
 * @param {boolean} [options.secure] Confirm channel + persistent messages.
 * @param {object} [options.recovery] Overrides of the reconnection policy (tests).
 * @returns {Promise<{ publish: Function, close: Function }>}
 */
export async function createRabbitPublisher({ url, secure = false, recovery } = {}) {
  // Cleared on each reconnection: a restarted broker may have lost the exchanges.
  const declared = new Set();
  const link = await openChannel({
    url,
    recovery,
    confirm: secure,
    role: 'publisher',
    prepare: async () => declared.clear(),
  });

  return {
    async publish(topic, message, { key = '' } = {}) {
      // Waits during a reconnection: callers see a slow or failed publish, never a silent drop.
      const channel = await link.channel();
      if (!declared.has(topic)) {
        await channel.assertExchange(topic, 'topic', { durable: true });
        declared.add(topic);
      }
      const content = Buffer.from(JSON.stringify(message));
      const properties = { contentType: 'application/json', persistent: secure };
      if (secure) {
        await publishConfirmed(channel, topic, key, content, properties);
      } else if (!channel.publish(topic, key, content, properties)) {
        await drained(channel);
      }
    },
    close: () => link.close(),
  };
}

/**
 * Creates a subscriber on RabbitMQ.
 * @param {object} options
 * @param {string} options.group Consumer group: the queue is `<topic>.<group>`.
 * @param {string} [options.url] AMQP URL (defaults to RABBITMQ_URL).
 * @param {number} [options.prefetch] Unacknowledged messages per consumer (unlimited by default).
 * @param {object} [options.recovery] Overrides of the reconnection policy (tests).
 * @returns {Promise<{ subscribe: Function, close: Function }>}
 */
export async function createRabbitSubscriber({ url, group, prefetch, recovery } = {}) {
  const subscriptions = [];
  const link = await openChannel({
    url,
    recovery,
    confirm: false,
    role: `subscriber/${group}`,
    // Consumers live on a channel: register them again after each reconnection.
    prepare: async (channel) => {
      if (prefetch) await channel.prefetch(prefetch);
      for (const subscription of subscriptions) await consume(channel, group, subscription);
    },
  });

  return {
    async subscribe(topic, handler) {
      const subscription = { topic, handler };
      await consume(await link.channel(), group, subscription);
      subscriptions.push(subscription);
    },
    close: () => link.close(),
  };
}

/** `channel()`: the live channel; waits while reconnecting, rejects once recovery gives up. */
async function openChannel({
  url = process.env.RABBITMQ_URL ?? DEFAULT_URL,
  recovery,
  confirm,
  role,
  prepare,
}) {
  let ready;
  let resolveReady;
  let rejectReady;
  const resetReady = () => {
    ready = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    ready.catch(() => {}); // reported to the next caller, not as an unhandled rejection
  };
  resetReady();

  let connection;
  try {
    connection = await amqp.connect(url, {
      // Visible in the RabbitMQ console; the tests rely on it to drop their own connections.
      clientProperties: { connection_name: `maison-epouvante/${role} (pid ${process.pid})` },
      recovery: {
        ...RECOVERY_POLICY,
        ...recovery,
        async setup(model) {
          const resolve = resolveReady; // a disconnection during setup replaces it
          const channel = confirm
            ? await model.createConfirmChannel()
            : await model.createChannel();
          channel.on('error', () => {}); // without a listener, a channel error kills the process
          await prepare(channel);
          resolve(channel);
        },
      },
    });
  } catch (error) {
    // Never echo the URL: it carries the password.
    throw new Error(`RabbitMQ unreachable (${role}): ${error.message}`, { cause: error });
  }

  // Required even with recovery: without it the process exits before amqplib reconnects.
  connection.on('error', () => {});
  connection.on('disconnect', resetReady);
  connection.on('reconnect-failed', (error) => {
    rejectReady(new Error(`RabbitMQ connection lost for good (${role}): ${error.message}`));
  });

  return {
    channel: () => ready,
    close: () => connection.close(),
  };
}

async function consume(channel, group, { topic, handler }) {
  const queue = `${topic}.${group}`;
  const rejects = `${queue}.rejets`;
  await channel.assertExchange(topic, 'topic', { durable: true });
  await channel.assertQueue(rejects, { durable: true });
  // Dead letter: a message nacked without requeue lands in `rejects` instead of being lost.
  await channel.assertQueue(queue, {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: rejects,
  });
  await channel.bindQueue(queue, topic, '#');

  // Classic queues do not count deliveries, so we do. Per process: with competing consumers
  // in several processes, each one may make its MAX_DELIVERIES attempts.
  const attempts = new Map();

  // amqplib does not await the callback: chaining handles one message at a time, like Kafka,
  // so any disorder the benchmark measures comes from the broker, not from this adapter.
  let tail = Promise.resolve();
  await channel.consume(queue, (delivery) => {
    if (delivery === null) return; // consumer cancelled by the broker (queue deleted)
    tail = tail.then(() => handleDelivery(channel, delivery, handler, { attempts, rejects }));
  });
}

async function handleDelivery(channel, delivery, handler, { attempts, rejects }) {
  const content = delivery.content.toString('utf8');
  let event;
  try {
    event = JSON.parse(content);
  } catch (error) {
    // Can never be parsed: retrying is pointless.
    console.error(`[messaging:rabbitmq] invalid JSON moved to ${rejects}:`, error.message);
    return settle(() => channel.nack(delivery, false, false));
  }

  const key = typeof event?.id === 'string' ? event.id : content;
  try {
    await handler(event);
    attempts.delete(key);
    settle(() => channel.ack(delivery));
  } catch (error) {
    const failures = (attempts.get(key) ?? 0) + 1;
    if (failures < MAX_DELIVERIES) {
      attempts.set(key, failures);
      settle(() => channel.nack(delivery, false, true));
    } else {
      attempts.delete(key);
      console.error(
        `[messaging:rabbitmq] message moved to ${rejects} after ${failures} failed attempts:`,
        error.message,
      );
      settle(() => channel.nack(delivery, false, false));
    }
  }
}

function settle(acknowledge) {
  try {
    acknowledge();
  } catch {
    // Channel closed meanwhile: the broker redelivers the message (at least once).
  }
}

function publishConfirmed(channel, exchange, key, content, properties) {
  return new Promise((resolve, reject) => {
    channel.publish(exchange, key, content, properties, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

/** Backpressure: waits for the socket buffer to empty (fails if the channel closes). */
function drained(channel) {
  return new Promise((resolve, reject) => {
    const onDrain = () => {
      channel.off('close', onClose);
      resolve();
    };
    const onClose = () => {
      channel.off('drain', onDrain);
      reject(new Error('RabbitMQ channel closed before the message left the client.'));
    };
    channel.once('drain', onDrain);
    channel.once('close', onClose);
  });
}
