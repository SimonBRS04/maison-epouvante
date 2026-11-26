import { readFileSync } from 'node:fs';

const SEED_FILE = new URL('../data/products.json', import.meta.url);

/** In-memory product store, seeded from data/products.json. */
export function createProductStore(seed = JSON.parse(readFileSync(SEED_FILE, 'utf8'))) {
  const products = new Map(seed.map((product) => [product.id, product]));
  let lastNumber = Math.max(0, ...seed.map((product) => Number(product.id.split('-')[1]) || 0));

  return {
    list({ categorie } = {}) {
      const all = [...products.values()];
      return categorie ? all.filter((product) => product.categorie === categorie) : all;
    },
    get(id) {
      return products.get(id);
    },
    add(fields) {
      lastNumber += 1;
      const product = { id: `p-${String(lastNumber).padStart(3, '0')}`, ...fields };
      products.set(product.id, product);
      return product;
    },
    remove(id) {
      return products.delete(id);
    },
  };
}
