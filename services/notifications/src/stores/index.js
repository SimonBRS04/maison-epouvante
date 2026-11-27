import { createMemoryNotificationStore } from './memory.js';
import { createPostgresNotificationStore } from './postgres.js';

const KINDS = ['memory', 'postgres'];

/**
 * Picks the notification store from the environment.
 *   STORE=memory   (default) unit tests and quick development
 *   STORE=postgres POC, benchmarks and demo; needs NOTIFICATIONS_DATABASE_URL
 */
export async function createNotificationStore({
  kind = process.env.STORE ?? 'memory',
  connectionString = process.env.NOTIFICATIONS_DATABASE_URL,
} = {}) {
  if (!KINDS.includes(kind)) {
    throw new Error(`Unknown STORE "${kind}". Allowed values: ${KINDS.join(', ')}.`);
  }
  return kind === 'postgres'
    ? createPostgresNotificationStore({ connectionString })
    : createMemoryNotificationStore();
}
