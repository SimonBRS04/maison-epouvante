/**
 * Shared messaging module — owner: Lot 4.
 *
 * Frozen interface (see docs/lots/lot-4-brokers.md):
 *   const publisher = await createPublisher({ broker });
 *   await publisher.publish('offers', event, { key: event.membreId });
 *
 *   const subscriber = await createSubscriber({ broker, group: 'notifications' });
 *   await subscriber.subscribe('offers', async (event) => { ... }); // throwing = redelivery
 *
 * Skeleton status: only the `memory` adapter is implemented.
 * The `kafka` and `rabbitmq` adapters are to be implemented by Lot 4.
 */
import { createMemoryPublisher, createMemorySubscriber } from './adapters/memory.js';

const BROKERS = ['memory', 'kafka', 'rabbitmq'];

/**
 * @param {object} [options]
 * @param {'memory'|'kafka'|'rabbitmq'} [options.broker]
 * @param {boolean} [options.secure] Acknowledgements + persistence (Kafka, RabbitMQ).
 */
export async function createPublisher({
  broker = process.env.BROKER ?? 'memory',
  ...options
} = {}) {
  assertKnownBroker(broker);
  if (broker === 'memory') return createMemoryPublisher(options);
  // TODO Lot 4: kafka (kafkajs) and rabbitmq (amqplib) adapters, with reconnection.
  throw new Error(`Broker "${broker}": to be implemented by Lot 4.`);
}

/**
 * @param {object} options
 * @param {string} options.group Consumer group (same group = competing consumers).
 * @param {'memory'|'kafka'|'rabbitmq'} [options.broker]
 * @param {boolean} [options.fromBeginning] Replay the history (Kafka).
 * @param {number} [options.prefetch] Unacknowledged messages per consumer (RabbitMQ).
 */
export async function createSubscriber({
  broker = process.env.BROKER ?? 'memory',
  group,
  ...options
} = {}) {
  assertKnownBroker(broker);
  if (!group) throw new Error('createSubscriber: the "group" option is required.');
  if (broker === 'memory') return createMemorySubscriber({ group, ...options });
  throw new Error(`Broker "${broker}": to be implemented by Lot 4.`);
}

export { resetMemoryBus } from './adapters/memory.js';

function assertKnownBroker(broker) {
  if (!BROKERS.includes(broker)) {
    throw new Error(`Unknown BROKER "${broker}". Allowed values: ${BROKERS.join(', ')}.`);
  }
}
