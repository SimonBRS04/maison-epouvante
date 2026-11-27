import { Router } from 'express';
import { offerCreatedEvent, OFFER_TOPIC } from '../events.js';
import { sendError } from '../http.js';
import { validateOffer } from '../validation.js';

export function offersRouter({ store, auth, publisher }) {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await store.list({ categorie: req.query.categorie }));
  });

  router.get('/:id', async (req, res) => {
    const offer = await store.get(req.params.id);
    if (!offer) return sendError(res, 404, 'INTROUVABLE', 'Offre introuvable.');
    return res.json(offer);
  });

  router.post('/', auth.requireRole('membre'), async (req, res) => {
    const { value, error } = validateOffer(req.body);
    if (error) return sendError(res, 400, 'VALIDATION', error);

    const offer = await store.add({ ...value, membreId: req.user.id });
    try {
      await publisher.publish(OFFER_TOPIC, offerCreatedEvent(offer), { key: offer.membreId });
    } catch (publishError) {
      // Documented choice: no offer without a possible notification → roll the creation back.
      await store.remove(offer.id);
      console.error('[troc] publishing failed:', publishError);
      return sendError(
        res,
        503,
        'MESSAGERIE_INDISPONIBLE',
        'Offre non créée, réessayez plus tard.',
      );
    }
    return res.status(201).json(offer);
  });

  return router;
}
