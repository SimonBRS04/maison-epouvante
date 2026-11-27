import { createDatabase } from '@maison-epouvante/db';
import { idNumber, loadSeed } from './seed.js';

const SCHEMA = new URL('../../db/schema.sql', import.meta.url);
const COLUMNS = 'id, nom, categorie, prix, stock, exclusif_en_ligne';

/**
 * PostgreSQL product store. Creates its schema on start-up and seeds the catalogue
 * the first time only (empty table), so restarts keep the data.
 */
export async function createPostgresProductStore({ connectionString, seed = loadSeed() }) {
  const db = createDatabase({ connectionString });
  await db.runSqlFile(SCHEMA);
  await seedIfEmpty(db, seed);

  return {
    async list({ categorie } = {}) {
      const { rows } = categorie
        ? await db.query(`SELECT ${COLUMNS} FROM products WHERE categorie = $1 ORDER BY id`, [
            categorie,
          ])
        : await db.query(`SELECT ${COLUMNS} FROM products ORDER BY id`);
      return rows.map(toProduct);
    },
    async get(id) {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM products WHERE id = $1`, [id]);
      return rows[0] ? toProduct(rows[0]) : undefined;
    },
    async add({ nom, categorie, prix, stock, exclusifEnLigne }) {
      const { rows } = await db.query(
        `INSERT INTO products (id, nom, categorie, prix, stock, exclusif_en_ligne)
         VALUES ('p-' || lpad(nextval('product_number')::text, 3, '0'), $1, $2, $3, $4, $5)
         RETURNING ${COLUMNS}`,
        [nom, categorie, prix, stock, exclusifEnLigne],
      );
      return toProduct(rows[0]);
    },
    async remove(id) {
      const { rowCount } = await db.query('DELETE FROM products WHERE id = $1', [id]);
      return rowCount > 0;
    },
    close: () => db.close(),
  };
}

async function seedIfEmpty(db, seed) {
  await db.transaction(async (client) => {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM products');
    if (rows[0].n > 0) return;

    for (const product of seed) {
      await client.query(
        `INSERT INTO products (id, nom, categorie, prix, stock, exclusif_en_ligne)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          product.id,
          product.nom,
          product.categorie,
          product.prix,
          product.stock,
          product.exclusifEnLigne,
        ],
      );
    }
    // Generated ids must continue after the seeded ones (p-011 after p-010).
    const lastNumber = Math.max(0, ...seed.map((product) => idNumber(product.id)));
    if (lastNumber > 0) await client.query('SELECT setval($1, $2)', ['product_number', lastNumber]);
  });
}

function toProduct(row) {
  return {
    id: row.id,
    nom: row.nom,
    categorie: row.categorie,
    prix: row.prix,
    stock: row.stock,
    exclusifEnLigne: row.exclusif_en_ligne,
  };
}
