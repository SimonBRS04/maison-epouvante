import { formatId, idNumber, loadSeed } from './seed.js';

/**
 * In-memory product store: for unit tests and quick local development only.
 * Data is lost on restart and not shared between instances.
 */
export function createMemoryProductStore({ seed = loadSeed() } = {}) {
  const products = new Map(seed.map((product) => [product.id, { ...product }]));
  let lastNumber = Math.max(0, ...seed.map((product) => idNumber(product.id)));

  return {
    async list({ categorie } = {}) {
      const all = [...products.values()];
      return categorie ? all.filter((product) => product.categorie === categorie) : all;
    },
    async get(id) {
      return products.get(id);
    },
    async add(fields) {
      lastNumber += 1;
      const product = { id: formatId(lastNumber), ...fields };
      products.set(product.id, product);
      return product;
    },
    async remove(id) {
      return products.delete(id);
    },
    async close() {},
  };
}
