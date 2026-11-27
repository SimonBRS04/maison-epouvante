/**
 * `rabbitmq` adapter (amqplib).
 * Same semantics as the other adapters (see docs/lots/lot-4-brokers.md, part A):
 *   - one durable `topic` exchange per topic (`offers`);
 *   - one durable queue per group (`offers.<group>`) bound to it with `#`:
 *     same group = competing consumers on one queue, different groups = one copy each;
 *   - a handler that throws gets its message nacked and requeued (redelivery).
 *
 * Reconnection uses amqplib's own recovery (opt-in since amqplib 1.1): we test the client
 * the way it would run in production instead of hand-written retry code.
 */
import amqp from 'amqplib';

const DEFAULT_URL = 'amqp://guest:guest@localhost:5672';

// 1 s, 2 s, 4 s, 8 s, 8 s: about 23 s of retries, enough to outlive the benchmark's
// 10 s broker outage plus RabbitMQ's boot time. No jitter, so runs stay reproducible.
const RECOVERY_POLICY = { initialDelay: 1000, factor: 2, maxDelay: 8000, jitter: 0, maxRetries: 5 };

/**
 * @param {object} [options]
 * @param {string} [options.url] AMQP URL (defaults to RABBITMQ_URL).
 * @param {boolean} [options.secure] Confirm channel + persistent messages.
 * @param {object} [options.recovery] Overrides of the reconnection policy (tests).
 * @returns {Promise<{ publish: Function, close: Function }>}
 */
export async function createRabbitPublisher({ url, secure = false, recovery } = {}) {
  // Exchanges are declared lazily, once per channel: a new channel after a reconnection
  // declares them again (cheap, and safe if the broker lost them).
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
      // While disconnected this waits for the reconnection (or rejects once recovery gives up),
      // so callers such as Troc see a slow or failed publish, never a silent drop.
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
    // Runs after every (re)connection: consumers live on a channel, so they must be
    // registered again on the new one.
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

/**
 * Opens a recovering connection and keeps one usable channel on it.
 * `channel()` resolves to the current channel, waits during a reconnection,
 * and rejects once amqplib gives up.
 */
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
    ready.catch(() => {}); // rejection is reported to the next caller, not as unhandled
  };
  resetReady();

  let connection;
  try {
    connection = await amqp.connect(url, {
      // Shown in the RabbitMQ console (Connections tab): tells services and tests apart.
      clientProperties: { connection_name: `maison-epouvante/${role} (pid ${process.pid})` },
      recovery: {
        ...RECOVERY_POLICY,
        ...recovery,
        async setup(model) {
          const resolve = resolveReady; // a disconnection during setup replaces it
          const channel = confirm
            ? await model.createConfirmChannel()
            : await model.createChannel();
          // Without a listener, a channel error would crash the process.
          channel.on('error', () => {});
          await prepare(channel);
          resolve(channel);
        },
      },
    });
  } catch (error) {
    // Never echo the URL: it carries the password.
    throw new Error(`RabbitMQ unreachable (${role}): ${error.message}`, { cause: error });
  }

  // `error` is followed by `disconnect` and recovery takes over; without a listener the
  // process would exit even though amqplib is about to reconnect.
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

/** Declares the topology of a group, then consumes its queue one message at a time. */
async function consume(channel, group, { topic, handler }) {
  const queue = `${topic}.${group}`;
  await channel.assertExchange(topic, 'topic', { durable: true });
  await channel.assertQueue(queue, { durable: true });
  await channel.bindQueue(queue, topic, '#');

  // amqplib does not wait for an async callback: chaining keeps one message in progress per
  // subscriber, like Kafka's eachMessage. Any disorder the benchmark measures then comes
  // from the broker and the competing consumers, not from this adapter.
  let tail = Promise.resolve();
  await channel.consume(queue, (delivery) => {
    if (delivery === null) return; // consumer cancelled by the broker (queue deleted)
    tail = tail.then(() => handleDelivery(channel, delivery, handler));
  });
}

async function handleDelivery(channel, delivery, handler) {
  let event;
  try {
    event = JSON.parse(delivery.content.toString('utf8'));
  } catch (error) {
    // Requeuing a message that can never be parsed would loop forever: drop it.
    console.error('[messaging:rabbitmq] dropped a message that is not valid JSON:', error.message);
    return settle(() => channel.nack(delivery, false, false));
  }
  try {
    await handler(event);
    settle(() => channel.ack(delivery));
  } catch {
    // Classic queues do not count deliveries: a handler that always fails is retried forever.
    settle(() => channel.nack(delivery, false, true));
  }
}

/** Ack/nack on a channel closed meanwhile throws; the broker redelivers the message anyway. */
function settle(acknowledge) {
  try {
    acknowledge();
  } catch {
    // Redelivered after the reconnection: the consumer may see it twice (at least once).
  }
}

function publishConfirmed(channel, exchange, key, content, properties) {
  return new Promise((resolve, reject) => {
    channel.publish(exchange, key, content, properties, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

/** Waits for the socket buffer to empty (backpressure), or fails if the channel closes. */
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
