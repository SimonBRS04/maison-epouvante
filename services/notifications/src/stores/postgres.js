import { createDatabase } from '@maison-epouvante/db';

const SCHEMA = new URL('../../db/schema.sql', import.meta.url);
const COLUMNS = 'id, membre_id, offer_id, titre, categorie, cree_a, lue';

/** PostgreSQL notification store. Creates its schema on start-up; no seed. */
export async function createPostgresNotificationStore({ connectionString }) {
  const db = createDatabase({ connectionString });
  await db.runSqlFile(SCHEMA);

  return {
    async add({ membreId, offerId, titre, categorie }) {
      const { rows } = await db.query(
        `INSERT INTO notifications (id, membre_id, offer_id, titre, categorie)
         VALUES ('n-' || lpad(nextval('notification_number')::text, 5, '0'), $1, $2, $3, $4)
         RETURNING ${COLUMNS}`,
        [membreId, offerId, titre, categorie],
      );
      return toNotification(rows[0]);
    },
    async list({ membreId } = {}) {
      const { rows } = membreId
        ? await db.query(`SELECT ${COLUMNS} FROM notifications WHERE membre_id = $1 ORDER BY id`, [
            membreId,
          ])
        : await db.query(`SELECT ${COLUMNS} FROM notifications ORDER BY id`);
      return rows.map(toNotification);
    },
    async isProcessed(eventId) {
      const { rowCount } = await db.query('SELECT 1 FROM processed_events WHERE event_id = $1', [
        eventId,
      ]);
      return rowCount > 0;
    },
    async markProcessed(eventId) {
      await db.query('INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING', [
        eventId,
      ]);
    },
    close: () => db.close(),
  };
}

function toNotification(row) {
  return {
    id: row.id,
    membreId: row.membre_id,
    offerId: row.offer_id,
    titre: row.titre,
    categorie: row.categorie,
    creeA: row.cree_a.toISOString(),
    lue: row.lue,
  };
}
