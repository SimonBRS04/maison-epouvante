import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createTestDatabase } from '../src/index.js';

const SERVER_URL = process.env.TEST_POSTGRES_URL;

describe('createDatabase', () => {
  it('requires a connection string', () => {
    expect(() => createDatabase({})).toThrow(/connectionString/);
  });
});

// Integration tests: run only when a PostgreSQL server is available (see CONTRIBUTING.md).
describe.skipIf(!SERVER_URL)('createDatabase against PostgreSQL', () => {
  let testDb;
  let db;

  beforeAll(async () => {
    testDb = await createTestDatabase(SERVER_URL);
    db = createDatabase({ connectionString: testDb.url });
    await db.query('CREATE TABLE items (id integer PRIMARY KEY)');
  });

  afterAll(async () => {
    await db.close();
    await testDb.drop();
  });

  it('commits a successful transaction', async () => {
    await db.transaction((client) => client.query('INSERT INTO items VALUES (1)'));
    const { rows } = await db.query('SELECT count(*)::int AS n FROM items WHERE id = 1');
    expect(rows[0].n).toBe(1);
  });

  it('rolls back a failing transaction', async () => {
    await expect(
      db.transaction(async (client) => {
        await client.query('INSERT INTO items VALUES (2)');
        throw new Error('simulated failure');
      }),
    ).rejects.toThrow('simulated failure');
    const { rows } = await db.query('SELECT count(*)::int AS n FROM items WHERE id = 2');
    expect(rows[0].n).toBe(0);
  });
});
