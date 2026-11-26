/**
 * Module de messagerie partagé — propriétaire : Lot 4.
 *
 * Interface figée (voir docs/lots/lot-4-brokers.md) :
 *   const publisher = await createPublisher({ broker });
 *   await publisher.publish('offers', event, { key: event.membreId });
 *
 *   const subscriber = await createSubscriber({ broker, group: 'notifications' });
 *   await subscriber.subscribe('offers', async (event) => { ... }); // lever une erreur = redistribution
 *
 * État du squelette : seul l'adaptateur `memory` est implémenté.
 * Les adaptateurs `kafka` et `rabbitmq` sont à implémenter par le Lot 4.
 */
import { createMemoryPublisher, createMemorySubscriber } from './adapters/memory.js';

const BROKERS = ['memory', 'kafka', 'rabbitmq'];

/**
 * @param {object} [options]
 * @param {'memory'|'kafka'|'rabbitmq'} [options.broker]
 * @param {boolean} [options.secure] Accusés de réception + persistance (Kafka, RabbitMQ).
 */
export async function createPublisher({
  broker = process.env.BROKER ?? 'memory',
  ...options
} = {}) {
  assertKnownBroker(broker);
  if (broker === 'memory') return createMemoryPublisher(options);
  // TODO Lot 4 : adaptateurs kafka (kafkajs) et rabbitmq (amqplib), avec reconnexion.
  throw new Error(`Broker "${broker}" : à implémenter par le Lot 4.`);
}

/**
 * @param {object} options
 * @param {string} options.group Groupe de consommateurs (même groupe = consommateurs concurrents).
 * @param {'memory'|'kafka'|'rabbitmq'} [options.broker]
 * @param {boolean} [options.fromBeginning] Relire l'historique (Kafka).
 * @param {number} [options.prefetch] Messages non acquittés par consommateur (RabbitMQ).
 */
export async function createSubscriber({
  broker = process.env.BROKER ?? 'memory',
  group,
  ...options
} = {}) {
  assertKnownBroker(broker);
  if (!group) throw new Error('createSubscriber : le paramètre "group" est obligatoire.');
  if (broker === 'memory') return createMemorySubscriber({ group, ...options });
  throw new Error(`Broker "${broker}" : à implémenter par le Lot 4.`);
}

export { resetMemoryBus } from './adapters/memory.js';

function assertKnownBroker(broker) {
  if (!BROKERS.includes(broker)) {
    throw new Error(`BROKER inconnu : "${broker}". Valeurs possibles : ${BROKERS.join(', ')}.`);
  }
}
