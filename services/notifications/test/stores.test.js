import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '@maison-epouvante/db';
import { createNotificationStore } from '../src/stores/index.js';
import { createMemoryNotificationStore } from '../src/stores/memory.js';
import { createPostgresNotificationStore } from '../src/stores/postgres.js';

const SERVER_URL = process.env.TEST_POSTGRES_URL;

const fields = { membreId: 'm-002', offerId: 'o-0010', titre: 'Figurine', categorie: 'figurines' };

/**
 * Contract shared by every notification store: both implementations must behave
 * identically, so switching STORE never changes what the API returns.
 */
function describeNotificationStore(label, openStore) {
  describe(label, () => {
    let store;
    let cleanup;

    beforeAll(async () => {
      ({ store, cleanup } = await openStore());
    });
    afterAll(async () => cleanup());

    it('adds notifications with increasing ids, unread, with a creation date', async () => {
      const first = await store.add(fields);
      const second = await store.add({ ...fields, membreId: 'm-003' });
      expect([first.id, second.id]).toEqual(['n-00001', 'n-00002']);
      expect(first).toMatchObject({ ...fields, lue: false });
      expect(Number.isNaN(Date.parse(first.creeA))).toBe(false);
    });

    it('lists every notification, or those of one member', async () => {
      expect(await store.list()).toHaveLength(2);
      expect((await store.list({ membreId: 'm-003' })).map((n) => n.id)).toEqual(['n-00002']);
    });

    it('remembers processed events', async () => {
      expect(await store.isProcessed('evt-1')).toBe(false);
      await store.markProcessed('evt-1');
      await store.markProcessed('evt-1');
      expect(await store.isProcessed('evt-1')).toBe(true);
    });
  });
}

describeNotificationStore('memory store', async () => ({
  store: createMemoryNotificationStore(),
  cleanup: async () => {},
}));

describe.skipIf(!SERVER_URL)('PostgreSQL', () => {
  describeNotificationStore('postgres store', async () => {
    const database = await createTestDatabase(SERVER_URL);
    const store = await createPostgresNotificationStore({ connectionString: database.url });
    return {
      store,
      cleanup: async () => {
        await store.close();
        await database.drop();
      },
    };
  });
});

describe('createNotificationStore', () => {
  it('rejects an unknown STORE', async () => {
    await expect(createNotificationStore({ kind: 'sqlite' })).rejects.toThrow(/Unknown STORE/);
  });
});
