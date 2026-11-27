/**
 * `kafka` adapter (@confluentinc/kafka-javascript, librdkafka underneath).
 *   - topic `<topic>` with TOPIC_PARTITIONS partitions, created on first use;
 *   - `group` is the consumer group: same group = competing consumers;
 *   - a handler that throws is retried, MAX_DELIVERIES attempts in total, then the message
 *     goes to the topic `<topic>.<group>.rejets`;
 *   - one message at a time per subscriber (the client's default).
 * The client reconnects on its own: nothing to rebuild after a broker restart.
 */
import confluent from '@confluentinc/kafka-javascript';
import { MAX_DELIVERIES } from '../deliveries.js';

const { Kafka, ErrorCodes, logLevel } = confluent.KafkaJS;

const DEFAULT_BROKERS = 'localhost:9092';

/** 3 partitions: up to 3 consumers of one group work in parallel (protocol of the bench). */
export const TOPIC_PARTITIONS = 3;

/**
 * Creates a publisher on Kafka.
 * @param {object} [options]
 * @param {string} [options.brokers] Comma-separated `host:port` list (defaults to KAFKA_BROKERS).
 * @param {boolean} [options.secure] Idempotent producer, acknowledged by all in-sync replicas.
 * @param {object} [options.retry] Overrides of the client's retry policy (tests).
 * @returns {Promise<{ publish: Function, close: Function }>}
 */
export async function createKafkaPublisher({ brokers, secure = false, retry } = {}) {
  const kafka = client({ brokers, retry, role: 'publisher' });
  // acks: -1 is already librdkafka's default; idempotence is what `secure` adds.
  const producer = kafka.producer({ kafkaJS: secure ? { idempotent: true, acks: -1 } : {} });
  await connect(producer, 'publisher');
  const topics = topicMaker(kafka);

  return {
    async publish(topic, message, { key } = {}) {
      await topics.ensure(topic, TOPIC_PARTITIONS);
      await producer.send({
        topic,
        messages: [{ key: key?.toString(), value: serialize(message) }],
      });
    },
    async close() {
      await producer.disconnect();
    },
  };
}

/**
 * Creates a subscriber on Kafka.
 * @param {object} options
 * @param {string} options.group Consumer group.
 * @param {string} [options.brokers] Comma-separated `host:port` list (defaults to KAFKA_BROKERS).
 * @param {boolean} [options.fromBeginning] A group without saved offsets starts at the first
 *   message of the topic instead of the next one.
 * @param {object} [options.retry] Overrides of the client's retry policy (tests).
 * @returns {Promise<{ subscribe: Function, close: Function }>}
 */
export async function createKafkaSubscriber({ brokers, group, fromBeginning = false, retry } = {}) {
  const kafka = client({ brokers, retry, role: `subscriber/${group}` });
  const topics = topicMaker(kafka);
  const consumers = [];
  let rejectsProducer;

  async function setAside(rejects, message, reason) {
    if (!rejectsProducer) {
      rejectsProducer = kafka.producer();
      await connect(rejectsProducer, `subscriber/${group}`);
    }
    await rejectsProducer.send({
      topic: rejects,
      messages: [{ key: message.key, value: message.value, headers: { reason: String(reason) } }],
    });
  }

  return {
    async subscribe(topic, handler) {
      const rejects = `${topic}.${group}.rejets`;
      await topics.ensure(topic, TOPIC_PARTITIONS);
      await topics.ensure(rejects, 1);

      let assigned;
      const firstAssignment = new Promise((resolve) => (assigned = resolve));
      const consumer = kafka.consumer({
        kafkaJS: { groupId: group, fromBeginning },
        rebalance_cb: async (event, assignment) => {
          if (event.code !== ErrorCodes.ERR__ASSIGN_PARTITIONS) return undefined;
          try {
            return fromBeginning ? undefined : await startAtEnd(kafka, group, topic, assignment);
          } finally {
            assigned();
          }
        },
      });
      await connect(consumer, `subscriber/${group}`);
      consumers.push(consumer);
      await consumer.subscribe({ topics: [topic] });
      await consumer.run({
        eachMessage: ({ message }) =>
          handleMessage(message, handler, (reason) => setAside(rejects, message, reason), rejects),
      });
      // Resolve once the group is joined and its start offsets are fixed, as RabbitMQ does once
      // its queue exists: a message published right after subscribe() is then not missed.
      await firstAssignment;
    },
    async close() {
      await Promise.allSettled(consumers.map((consumer) => consumer.disconnect()));
      await rejectsProducer?.disconnect();
    },
  };
}

/**
 * A new group would start at the end of each partition, but librdkafka resolves "the end"
 * lazily, at its first fetch: a message published in between would be skipped. Fixing the
 * offset at assignment closes that gap; partitions with a saved offset are left untouched.
 */
async function startAtEnd(kafka, group, topic, assignment) {
  const admin = kafka.admin();
  await connect(admin, 'admin');
  try {
    const partitions = assignment.map((tp) => tp.partition);
    // Partitions must be listed: with the topic name alone, a group without offsets gets [].
    const [saved] = await admin.fetchOffsets({ groupId: group, topics: [{ topic, partitions }] });
    const ends = await admin.fetchTopicOffsets(topic);
    const offsetOf = (list, tp, field) =>
      Number(list.find((p) => p.partition === tp.partition)?.[field] ?? -1);
    return assignment.map((tp) => {
      if (offsetOf(saved.partitions, tp, 'offset') >= 0) return tp;
      // -1 on a topic created a moment ago, whose leader is not elected yet: it is empty.
      return { ...tp, offset: Math.max(0, offsetOf(ends, tp, 'high')) };
    });
  } finally {
    await admin.disconnect();
  }
}

/** Returning normally commits the offset; throwing (setAside failed) gets it redelivered. */
async function handleMessage(message, handler, setAside, rejects) {
  let event;
  try {
    event = JSON.parse(message.value);
  } catch (error) {
    console.error(`[messaging:kafka] invalid JSON moved to ${rejects}:`, error.message);
    await setAside(`invalid JSON: ${error.message}`);
    return;
  }
  // Retried in place: the partition belongs to this consumer, so the order is kept.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await handler(event);
      return;
    } catch (error) {
      if (attempt >= MAX_DELIVERIES) {
        console.error(
          `[messaging:kafka] message moved to ${rejects} after ${attempt} failed attempts:`,
          error,
        );
        await setAside(error.message);
        return;
      }
    }
  }
}

function client({ brokers = process.env.KAFKA_BROKERS ?? DEFAULT_BROKERS, retry, role }) {
  return new Kafka({
    kafkaJS: {
      brokers: brokers.split(',').map((broker) => broker.trim()),
      clientId: `maison-epouvante/${role}`,
      retry,
      // librdkafka logs every rebalance at INFO: keep the service logs readable.
      logLevel: logLevel.WARN,
      logger: quietLogger(),
    },
  });
}

/**
 * One line per log, and each kind of message once a minute at most: librdkafka reports every
 * failed reconnection attempt, about 800 lines for a 20 s outage with the default logger.
 */
function quietLogger() {
  const lastSeen = new Map();
  let level = logLevel.WARN;
  const at =
    (severity, print) =>
    (message, extra = {}) => {
      if (severity > level) return;
      const kind = String(message).replace(/\d+/g, '#');
      const now = Date.now();
      if (now - (lastSeen.get(kind) ?? -Infinity) < 60_000) return;
      lastSeen.set(kind, now);
      print(`[messaging:kafka] ${message}${extra.name ? ` (${extra.name})` : ''}`);
    };
  const logger = {
    error: at(logLevel.ERROR, console.error),
    warn: at(logLevel.WARN, console.warn),
    info: at(logLevel.INFO, console.info),
    debug: at(logLevel.DEBUG, console.debug),
    setLogLevel: (newLevel) => (level = newLevel),
    namespace: () => logger,
  };
  return logger;
}

async function connect(clientPart, role) {
  try {
    await clientPart.connect();
  } catch (error) {
    throw new Error(`Kafka unreachable (${role}): ${error.message}`, { cause: error });
  }
}

/** Creates each topic once; the broker refuses automatic creation (infra/brokers/compose.yml). */
function topicMaker(kafka) {
  const known = new Map();
  return {
    ensure(topic, numPartitions) {
      if (!known.has(topic)) {
        const creation = createTopic(kafka, topic, numPartitions);
        creation.catch(() => known.delete(topic)); // retried on the next call
        known.set(topic, creation);
      }
      return known.get(topic);
    },
  };
}

async function createTopic(kafka, topic, numPartitions) {
  const admin = kafka.admin();
  await connect(admin, 'admin');
  try {
    await admin.createTopics({ topics: [{ topic, numPartitions }] }); // existing topic: no-op
  } finally {
    await admin.disconnect();
  }
}

function serialize(message) {
  return Buffer.from(JSON.stringify(message));
}
