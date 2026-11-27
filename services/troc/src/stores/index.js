import { createMemoryOfferStore } from './memory.js';
import { createPostgresOfferStore } from './postgres.js';

const KINDS = ['memory', 'postgres'];

/**
 * Picks the offer store from the environment.
 *   STORE=memory   (default) unit tests and quick development
 *   STORE=postgres POC, benchmarks and demo; needs TROC_DATABASE_URL
 */
export async function createOfferStore({
  kind = process.env.STORE ?? 'memory',
  connectionString = process.env.TROC_DATABASE_URL,
  seed,
} = {}) {
  if (!KINDS.includes(kind)) {
    throw new Error(`Unknown STORE "${kind}". Allowed values: ${KINDS.join(', ')}.`);
  }
  return kind === 'postgres'
    ? createPostgresOfferStore({ connectionString, seed })
    : createMemoryOfferStore({ seed });
}
