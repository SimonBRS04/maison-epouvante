import { readFileSync } from 'node:fs';

const INTERESTS_FILE = new URL('../data/interests.json', import.meta.url);

export function loadInterests() {
  return JSON.parse(readFileSync(INTERESTS_FILE, 'utf8'));
}

/**
 * Turns an offer.created event into notifications for the interested members.
 * Idempotent: the same event delivered twice creates no duplicate
 * (brokers guarantee "at least once", not "exactly once").
 *
 * @param {object} deps
 * @param {object} deps.store Notification store, from createNotificationStore() (src/stores).
 * @param {Record<string, string[]>} [deps.interests] membreId → followed categories
 */
export function createNotifier({ store, interests = loadInterests() }) {
  return {
    /** @returns {Promise<object[]>} The notifications created (empty if already processed). */
    async handle(event) {
      if (event.type !== 'offer.created') return [];
      if (await store.isProcessed(event.id)) return [];

      const { offerId, titre, categorie } = event.payload;
      const recipients = Object.entries(interests)
        .filter(
          ([membreId, categories]) => membreId !== event.membreId && categories.includes(categorie),
        )
        .map(([membreId]) => membreId);

      const created = [];
      for (const membreId of recipients) {
        created.push(await store.add({ membreId, offerId, titre, categorie }));
      }
      await store.markProcessed(event.id);
      return created;
    },
  };
}
