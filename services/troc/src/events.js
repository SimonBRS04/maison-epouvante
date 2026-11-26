import { randomUUID } from 'node:crypto';

export const OFFER_TOPIC = 'offers';

/** Construit l'événement offer.created au format du socle commun (§6). */
export function offerCreatedEvent(offer) {
  return {
    id: randomUUID(),
    type: 'offer.created',
    envoyeA: new Date().toISOString(),
    membreId: offer.membreId,
    payload: {
      offerId: offer.id,
      titre: offer.titre,
      type: offer.type,
      categorie: offer.categorie,
    },
  };
}
