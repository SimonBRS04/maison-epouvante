import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '@maison-epouvante/db';
import { createProductStore } from '../src/stores/index.js';
import { createMemoryProductStore } from '../src/stores/memory.js';
import { createPostgresProductStore } from '../src/stores/postgres.js';

const SERVER_URL = process.env.TEST_POSTGRES_URL;

const seed = [
  {
    id: 'p-001',
    nom: 'Figurine',
    categorie: 'figurines',
    prix: 4990,
    stock: 3,
    exclusifEnLigne: true,
  },
  {
    id: 'p-002',
    nom: 'Blu-ray',
    categorie: 'blu-ray',
    prix: 2990,
    stock: 5,
    exclusifEnLigne: false,
  },
];
const newProduct = {
  nom: 'Mug',
  categorie: 'goodies',
  prix: 1290,
  stock: 10,
  exclusifEnLigne: false,
};

/**
 * Contract shared by every product store: both implementations must behave
 * identically, so switching STORE never changes what the API returns.
 */
function describeProductStore(label, openStore) {
  describe(label, () => {
    let store;
    let cleanup;

    beforeAll(async () => {
      ({ store, cleanup } = await openStore());
    });
    afterAll(async () => cleanup());

    it('starts from the seed, ordered by id', async () => {
      expect((await store.list()).map((p) => p.id)).toEqual(['p-001', 'p-002']);
    });

    it('filters by category', async () => {
      expect((await store.list({ categorie: 'blu-ray' })).map((p) => p.id)).toEqual(['p-002']);
    });

    it('returns undefined for an unknown id', async () => {
      expect(await store.get('p-999')).toBeUndefined();
    });

    it('adds a product with the next id, after the seeded ones', async () => {
      const created = await store.add(newProduct);
      expect(created).toEqual({ id: 'p-003', ...newProduct });
      expect(await store.get('p-003')).toEqual(created);
    });

    it('removes a product and reports whether it existed', async () => {
      expect(await store.remove('p-001')).toBe(true);
      expect(await store.remove('p-001')).toBe(false);
      expect(await store.get('p-001')).toBeUndefined();
    });
  });
}

describeProductStore('memory store', async () => ({
  store: createMemoryProductStore({ seed: structuredClone(seed) }),
  cleanup: async () => {},
}));

describe.skipIf(!SERVER_URL)('PostgreSQL', () => {
  describeProductStore('postgres store', async () => {
    const database = await createTestDatabase(SERVER_URL);
    const store = await createPostgresProductStore({ connectionString: database.url, seed });
    return {
      store,
      cleanup: async () => {
        await store.close();
        await database.drop();
      },
    };
  });

  it('seeds only once: a restart keeps the data', async () => {
    const database = await createTestDatabase(SERVER_URL);
    const first = await createPostgresProductStore({ connectionString: database.url, seed });
    await first.remove('p-001');
    await first.close();

    const restarted = await createPostgresProductStore({ connectionString: database.url, seed });
    expect((await restarted.list()).map((p) => p.id)).toEqual(['p-002']);
    await restarted.close();
    await database.drop();
  });
});

describe('createProductStore', () => {
  it('rejects an unknown STORE', async () => {
    await expect(createProductStore({ kind: 'sqlite' })).rejects.toThrow(/Unknown STORE/);
  });
});
