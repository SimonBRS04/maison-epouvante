/**
 * Adaptateur `memory` : un bus d'événements dans le processus.
 * Mêmes règles que les vrais brokers :
 *   - chaque groupe reçoit sa copie du message ;
 *   - dans un groupe, les consommateurs se partagent les messages (tour de rôle) ;
 *   - un traitement qui lève une erreur est redistribué (MAX_DELIVERIES tentatives au total) ;
 *   - le message est sérialisé en JSON, comme sur le réseau.
 * Ne traverse pas les processus ni les conteneurs : développement et tests uniquement.
 */
const MAX_DELIVERIES = 5;

/** topic → (groupe → { handlers, nextIndex }) */
let bus = new Map();

/** Vide le bus (à appeler entre deux tests). */
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

/** Livraison asynchrone, comme un vrai broker : publish() n'attend pas le traitement. */
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
        console.error(`[messaging:memory] message abandonné après ${attempt} tentatives :`, error);
      }
    }
  });
}
