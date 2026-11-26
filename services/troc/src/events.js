import { randomUUID } from 'node:crypto';

export const OFFER_TOPIC = 'offers';

/** Builds the offer.created event in the shared format (socle commun, section 6). */
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
