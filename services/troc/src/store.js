import { readFileSync } from 'node:fs';

const SEED_FILE = new URL('../data/offers.json', import.meta.url);

/** Stockage en mémoire des offres, initialisé depuis data/offers.json. */
export function createOfferStore(seed = JSON.parse(readFileSync(SEED_FILE, 'utf8'))) {
  const offers = new Map(seed.map((offer) => [offer.id, offer]));
  let lastNumber = Math.max(0, ...seed.map((offer) => Number(offer.id.split('-')[1]) || 0));

  return {
    list({ categorie } = {}) {
      const all = [...offers.values()];
      return categorie ? all.filter((offer) => offer.categorie === categorie) : all;
    },
    get(id) {
      return offers.get(id);
    },
    add(fields) {
      lastNumber += 1;
      const offer = { id: `o-${String(lastNumber).padStart(4, '0')}`, ...fields };
      offers.set(offer.id, offer);
      return offer;
    },
    remove(id) {
      return offers.delete(id);
    },
  };
}
