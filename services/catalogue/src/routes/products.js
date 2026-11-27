import { Router } from 'express';
import { sendError } from '../http.js';
import { validateProduct } from '../validation.js';

export function productsRouter({ store, auth }) {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await store.list({ categorie: req.query.categorie }));
  });

  router.get('/:id', async (req, res) => {
    const product = await store.get(req.params.id);
    if (!product) return sendError(res, 404, 'INTROUVABLE', 'Produit introuvable.');
    return res.json(product);
  });

  router.post('/', auth.requireRole('moderateur'), async (req, res) => {
    const { value, error } = validateProduct(req.body);
    if (error) return sendError(res, 400, 'VALIDATION', error);
    return res.status(201).json(await store.add(value));
  });

  router.delete('/:id', auth.requireRole('moderateur'), async (req, res) => {
    if (!(await store.remove(req.params.id))) {
      return sendError(res, 404, 'INTROUVABLE', 'Produit introuvable.');
    }
    return res.status(204).end();
  });

  return router;
}
