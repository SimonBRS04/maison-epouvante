import express from 'express';
import { createAuth } from '@maison-epouvante/auth';
import { errorHandler, notFoundHandler } from './http.js';
import { healthRouter } from './routes/health.js';
import { productsRouter } from './routes/products.js';

/**
 * Builds the application without starting it (testable with Supertest).
 * @param {object} deps
 * @param {object} deps.store Product store, from createProductStore() (src/stores).
 * @param {object} [deps.auth] Authentication middleware, from @maison-epouvante/auth.
 */
export function createApp({ store, auth = createAuth() }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter());
  app.use('/products', productsRouter({ store, auth }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
