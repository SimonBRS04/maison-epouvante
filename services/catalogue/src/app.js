import express from 'express';
import { createAuth } from '@maison-epouvante/auth';
import { errorHandler, notFoundHandler } from './http.js';
import { healthRouter } from './routes/health.js';
import { productsRouter } from './routes/products.js';
import { createProductStore } from './store.js';

/**
 * Crée l'application sans la démarrer (testable avec Supertest).
 * Les dépendances sont injectables pour les tests.
 */
export function createApp({ auth = createAuth(), store = createProductStore() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter());
  app.use('/products', productsRouter({ store, auth }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
