import { createDatabase } from '@maison-epouvante/db';
import { idNumber, loadSeed } from './seed.js';

const SCHEMA = new URL('../../db/schema.sql', import.meta.url);
const COLUMNS = 'id, membre_id, titre, description, type, categorie, cree_a';

/**
 * PostgreSQL offer store. Creates its schema on start-up and seeds the offers
 * the first time only (empty table), so restarts keep the data.
 */
export async function createPostgresOfferStore({ connectionString, seed = loadSeed() }) {
  const db = createDatabase({ connectionString });
  await db.runSqlFile(SCHEMA);
  await seedIfEmpty(db, seed);

  return {
    async list({ categorie } = {}) {
      const { rows } = categorie
        ? await db.query(`SELECT ${COLUMNS} FROM offers WHERE categorie = $1 ORDER BY id`, [
            categorie,
          ])
        : await db.query(`SELECT ${COLUMNS} FROM offers ORDER BY id`);
      return rows.map(toOffer);
    },
    async get(id) {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM offers WHERE id = $1`, [id]);
      return rows[0] ? toOffer(rows[0]) : undefined;
    },
    async add({ membreId, titre, description, type, categorie, creeA }) {
      const { rows } = await db.query(
        `INSERT INTO offers (id, membre_id, titre, description, type, categorie, cree_a)
         VALUES ('o-' || lpad(nextval('offer_number')::text, 4, '0'), $1, $2, $3, $4, $5,
                 COALESCE($6::timestamptz, now()))
         RETURNING ${COLUMNS}`,
        [membreId, titre, description, type, categorie, creeA ?? null],
      );
      return toOffer(rows[0]);
    },
    async remove(id) {
      const { rowCount } = await db.query('DELETE FROM offers WHERE id = $1', [id]);
      return rowCount > 0;
    },
    close: () => db.close(),
  };
}

async function seedIfEmpty(db, seed) {
  await db.transaction(async (client) => {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM offers');
    if (rows[0].n > 0) return;

    for (const offer of seed) {
      await client.query(
        `INSERT INTO offers (id, membre_id, titre, description, type, categorie, cree_a)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          offer.id,
          offer.membreId,
          offer.titre,
          offer.description,
          offer.type,
          offer.categorie,
          offer.creeA,
        ],
      );
    }
    // Generated ids must continue after the seeded ones (o-0004 after o-0003).
    const lastNumber = Math.max(0, ...seed.map((offer) => idNumber(offer.id)));
    if (lastNumber > 0) await client.query('SELECT setval($1, $2)', ['offer_number', lastNumber]);
  });
}

function toOffer(row) {
  return {
    id: row.id,
    membreId: row.membre_id,
    titre: row.titre,
    description: row.description,
    type: row.type,
    categorie: row.categorie,
    creeA: row.cree_a.toISOString(),
  };
}
