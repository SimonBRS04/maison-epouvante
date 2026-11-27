const formatId = (number) => `n-${String(number).padStart(5, '0')}`;

/**
 * In-memory notification store: for unit tests and quick local development only.
 * Data is lost on restart and not shared between instances.
 */
export function createMemoryNotificationStore() {
  const notifications = [];
  const processedEventIds = new Set();
  let lastNumber = 0;

  return {
    async add(fields) {
      lastNumber += 1;
      const notification = {
        id: formatId(lastNumber),
        creeA: new Date().toISOString(),
        lue: false,
        ...fields,
      };
      notifications.push(notification);
      return notification;
    },
    async list({ membreId } = {}) {
      return membreId ? notifications.filter((n) => n.membreId === membreId) : [...notifications];
    },
    async isProcessed(eventId) {
      return processedEventIds.has(eventId);
    },
    async markProcessed(eventId) {
      processedEventIds.add(eventId);
    },
    async close() {},
  };
}
