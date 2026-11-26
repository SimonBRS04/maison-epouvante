/** Stockage en mémoire des notifications et des événements déjà traités. */
export function createNotificationStore() {
  const notifications = [];
  const processedEventIds = new Set();
  let lastNumber = 0;

  return {
    add(fields) {
      lastNumber += 1;
      const notification = {
        id: `n-${String(lastNumber).padStart(5, '0')}`,
        lue: false,
        ...fields,
      };
      notifications.push(notification);
      return notification;
    },
    list({ membreId } = {}) {
      return membreId ? notifications.filter((n) => n.membreId === membreId) : [...notifications];
    },
    isProcessed(eventId) {
      return processedEventIds.has(eventId);
    },
    markProcessed(eventId) {
      processedEventIds.add(eventId);
    },
  };
}
