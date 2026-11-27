/**
 * @maison-epouvante/db — the only place where the services talk to PostgreSQL
 * directly. Services build their own store on top of it (services/<name>/src/stores/postgres.js).
 */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

/**
 * Opens a connection pool.
 *
 * @param {{ connectionString: string, max?: number }} options
 *   max: pool size; 10 matches the default of node-postgres and suits the load tests.
 */
export function createDatabase({ connectionString, max = 10 }) {
  if (!connectionString) {
    throw new Error('createDatabase: connectionString is required (see .env.example).');
  }
  const pool = new pg.Pool({ connectionString, max });
  // An idle connection dropped by the server (restart, network cut) is reported here.
  // Without a listener Node would crash the whole service; the pool reconnects on next use.
  pool.on('error', (error) => {
    console.error('[db] idle connection lost:', error.message);
  });

  return {
    /** Runs one parameterised query. Never interpolate values into SQL: always use $1, $2… */
    query(text, params) {
      return pool.query(text, params);
    },

    /**
     * Runs `work` inside a transaction on a dedicated connection: committed if it
     * resolves, rolled back if it throws. `work` receives that connection.
     */
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    /** Executes a .sql file (idempotent schemas: CREATE … IF NOT EXISTS). */
    async runSqlFile(fileUrl) {
      await pool.query(await readFile(fileUrl, 'utf8'));
    },

    close() {
      return pool.end();
    },
  };
}

/**
 * Creates a throw-away database for integration tests, so that tests never touch
 * real data and can run in parallel.
 *
 * @param {string} serverUrl URL of the PostgreSQL server, e.g. postgres://maison:maison_dev@localhost:5432
 * @returns {Promise<{ url: string, drop: () => Promise<void> }>}
 */
export async function createTestDatabase(serverUrl) {
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: `${serverUrl}/postgres` });
  await admin.connect();
  try {
    // Identifiers cannot be parameterised; `name` is generated above, never user input.
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }

  return {
    url: `${serverUrl}/${name}`,
    async drop() {
      const client = new pg.Client({ connectionString: `${serverUrl}/postgres` });
      await client.connect();
      try {
        await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await client.end();
      }
    },
  };
}
