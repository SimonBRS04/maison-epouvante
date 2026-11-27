import { formatId, idNumber, loadSeed } from './seed.js';

/**
 * In-memory offer store: for unit tests and quick local development only.
 * Data is lost on restart and not shared between instances.
 */
export function createMemoryOfferStore({ seed = loadSeed() } = {}) {
  const offers = new Map(seed.map((offer) => [offer.id, { ...offer }]));
  let lastNumber = Math.max(0, ...seed.map((offer) => idNumber(offer.id)));

  return {
    async list({ categorie } = {}) {
      const all = [...offers.values()];
      return categorie ? all.filter((offer) => offer.categorie === categorie) : all;
    },
    async get(id) {
      return offers.get(id);
    },
    async add(fields) {
      lastNumber += 1;
      const offer = { id: formatId(lastNumber), creeA: new Date().toISOString(), ...fields };
      offers.set(offer.id, offer);
      return offer;
    },
    async remove(id) {
      return offers.delete(id);
    },
    async close() {},
  };
}
