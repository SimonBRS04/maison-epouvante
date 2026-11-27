/**
 * `memory` adapter: an in-process event bus.
 * Same rules as the real brokers:
 *   - each group receives its own copy of the message;
 *   - within a group, consumers share the messages (round robin);
 *   - a handler that throws gets the message redelivered (MAX_DELIVERIES attempts in total);
 *   - the message is serialised to JSON, as on the network.
 * Does not cross processes or containers: development and tests only.
 */
import { MAX_DELIVERIES } from '../deliveries.js';

/** topic → (group → { handlers, nextIndex }) */
let bus = new Map();

/** Empties the bus (call it between tests). */
export function resetMemoryBus() {
  bus = new Map();
}

export function createMemoryPublisher() {
  return {
    async publish(topic, message, _options = {}) {
      const serialized = JSON.stringify(message);
      for (const group of groupsOf(topic).values()) {
        deliver(group, serialized, 1);
      }
    },
    async close() {},
  };
}

export function createMemorySubscriber({ group }) {
  const registrations = [];
  return {
    async subscribe(topic, handler) {
      const groups = groupsOf(topic);
      if (!groups.has(group)) groups.set(group, { handlers: [], nextIndex: 0 });
      groups.get(group).handlers.push(handler);
      registrations.push({ topic, handler });
    },
    async close() {
      for (const { topic, handler } of registrations) {
        const entry = groupsOf(topic).get(group);
        if (entry) entry.handlers = entry.handlers.filter((h) => h !== handler);
      }
      registrations.length = 0;
    },
  };
}

function groupsOf(topic) {
  if (!bus.has(topic)) bus.set(topic, new Map());
  return bus.get(topic);
}

/** Asynchronous delivery, like a real broker: publish() does not wait for processing. */
function deliver(group, serialized, attempt) {
  setImmediate(async () => {
    if (group.handlers.length === 0) return;
    const handler = group.handlers[group.nextIndex % group.handlers.length];
    group.nextIndex += 1;
    try {
      await handler(JSON.parse(serialized));
    } catch (error) {
      if (attempt < MAX_DELIVERIES) {
        deliver(group, serialized, attempt + 1);
      } else {
        console.error(`[messaging:memory] message dropped after ${attempt} attempts:`, error);
      }
    }
  });
}
