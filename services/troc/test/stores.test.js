import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '@maison-epouvante/db';
import { createOfferStore } from '../src/stores/index.js';
import { createMemoryOfferStore } from '../src/stores/memory.js';
import { createPostgresOfferStore } from '../src/stores/postgres.js';

const SERVER_URL = process.env.TEST_POSTGRES_URL;

const seed = [
  {
    id: 'o-0001',
    membreId: 'm-001',
    titre: 'Figurine',
    description: '',
    type: 'echange',
    categorie: 'figurines',
    creeA: '2026-11-20T18:02:00.000Z',
  },
  {
    id: 'o-0002',
    membreId: 'm-002',
    titre: 'Fanzines',
    description: 'Un peu cornés',
    type: 'don',
    categorie: 'fanzine',
    creeA: '2026-11-22T09:41:00.000Z',
  },
];
const newOffer = { membreId: 'm-042', titre: 'BD', description: '', type: 'don', categorie: 'bd' };

/**
 * Contract shared by every offer store: both implementations must behave
 * identically, so switching STORE never changes what the API returns.
 */
function describeOfferStore(label, openStore) {
  describe(label, () => {
    let store;
    let cleanup;

    beforeAll(async () => {
      ({ store, cleanup } = await openStore());
    });
    afterAll(async () => cleanup());

    it('starts from the seed, ordered by id, with ISO dates', async () => {
      expect(await store.list()).toEqual(seed);
    });

    it('filters by category', async () => {
      expect((await store.list({ categorie: 'fanzine' })).map((o) => o.id)).toEqual(['o-0002']);
    });

    it('adds an offer with the next id and a creation date', async () => {
      const created = await store.add(newOffer);
      expect(created).toMatchObject({ id: 'o-0003', ...newOffer });
      expect(Number.isNaN(Date.parse(created.creeA))).toBe(false);
      expect(await store.get('o-0003')).toEqual(created);
    });

    it('removes an offer and reports whether it existed', async () => {
      expect(await store.remove('o-0003')).toBe(true);
      expect(await store.remove('o-0003')).toBe(false);
    });
  });
}

describeOfferStore('memory store', async () => ({
  store: createMemoryOfferStore({ seed: structuredClone(seed) }),
  cleanup: async () => {},
}));

describe.skipIf(!SERVER_URL)('PostgreSQL', () => {
  describeOfferStore('postgres store', async () => {
    const database = await createTestDatabase(SERVER_URL);
    const store = await createPostgresOfferStore({ connectionString: database.url, seed });
    return {
      store,
      cleanup: async () => {
        await store.close();
        await database.drop();
      },
    };
  });
});

describe('createOfferStore', () => {
  it('rejects an unknown STORE', async () => {
    await expect(createOfferStore({ kind: 'sqlite' })).rejects.toThrow(/Unknown STORE/);
  });
});
