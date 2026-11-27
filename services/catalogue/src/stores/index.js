import { createMemoryProductStore } from './memory.js';
import { createPostgresProductStore } from './postgres.js';

const KINDS = ['memory', 'postgres'];

/**
 * Picks the product store from the environment.
 *   STORE=memory   (default) unit tests and quick development
 *   STORE=postgres POC, benchmarks and demo; needs CATALOGUE_DATABASE_URL
 */
export async function createProductStore({
  kind = process.env.STORE ?? 'memory',
  connectionString = process.env.CATALOGUE_DATABASE_URL,
  seed,
} = {}) {
  if (!KINDS.includes(kind)) {
    throw new Error(`Unknown STORE "${kind}". Allowed values: ${KINDS.join(', ')}.`);
  }
  return kind === 'postgres'
    ? createPostgresProductStore({ connectionString, seed })
    : createMemoryProductStore({ seed });
}
