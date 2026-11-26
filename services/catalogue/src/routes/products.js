import { Router } from 'express';
import { sendError } from '../http.js';
import { validateProduct } from '../validation.js';

export function productsRouter({ store, auth }) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(store.list({ categorie: req.query.categorie }));
  });

  router.get('/:id', (req, res) => {
    const product = store.get(req.params.id);
    if (!product) return sendError(res, 404, 'INTROUVABLE', 'Produit introuvable.');
    return res.json(product);
  });

  router.post('/', auth.requireRole('moderateur'), (req, res) => {
    const { value, error } = validateProduct(req.body);
    if (error) return sendError(res, 400, 'VALIDATION', error);
    return res.status(201).json(store.add(value));
  });

  router.delete('/:id', auth.requireRole('moderateur'), (req, res) => {
    if (!store.remove(req.params.id)) {
      return sendError(res, 404, 'INTROUVABLE', 'Produit introuvable.');
    }
    return res.status(204).end();
  });

  return router;
}
