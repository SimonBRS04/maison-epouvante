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
 * Status: `memory` and `rabbitmq` are implemented; `kafka` is still to come (Lot 4, J3).
 */
import { createMemoryPublisher, createMemorySubscriber } from './adapters/memory.js';

const BROKERS = ['memory', 'kafka', 'rabbitmq'];

/**
 * Creates a publisher for the chosen broker.
 * @param {object} [options]
 * @param {'memory'|'kafka'|'rabbitmq'} [options.broker]
 * @param {boolean} [options.secure] Acknowledgements + persistence (Kafka, RabbitMQ).
 * @returns {Promise<{ publish: Function, close: Function }>}
 */
export async function createPublisher({
  broker = process.env.BROKER ?? 'memory',
  ...options
} = {}) {
  assertKnownBroker(broker);
  if (broker === 'memory') return createMemoryPublisher(options);
  if (broker === 'rabbitmq') return (await loadRabbit()).createRabbitPublisher(options);
  // TODO Lot 4 (J3): kafka adapter (@confluentinc/kafka-javascript).
  throw new Error(`Broker "${broker}": to be implemented by Lot 4.`);
}

/**
 * Creates a subscriber for the chosen broker.
 * @param {object} options
 * @param {string} options.group Consumer group (same group = competing consumers).
 * @param {'memory'|'kafka'|'rabbitmq'} [options.broker]
 * @param {boolean} [options.fromBeginning] Replay the history (Kafka).
 * @param {number} [options.prefetch] Unacknowledged messages per consumer (RabbitMQ).
 * @returns {Promise<{ subscribe: Function, close: Function }>}
 */
export async function createSubscriber({
  broker = process.env.BROKER ?? 'memory',
  group,
  ...options
} = {}) {
  assertKnownBroker(broker);
  if (!group) throw new Error('createSubscriber: the "group" option is required.');
  if (broker === 'memory') return createMemorySubscriber({ group, ...options });
  if (broker === 'rabbitmq')
    return (await loadRabbit()).createRabbitSubscriber({ group, ...options });
  throw new Error(`Broker "${broker}": to be implemented by Lot 4.`);
}

export { resetMemoryBus } from './adapters/memory.js';

// Loaded on demand: unit tests and development with BROKER=memory need no broker library.
function loadRabbit() {
  return import('./adapters/rabbitmq.js');
}

function assertKnownBroker(broker) {
  if (!BROKERS.includes(broker)) {
    throw new Error(`Unknown BROKER "${broker}". Allowed values: ${BROKERS.join(', ')}.`);
  }
}
