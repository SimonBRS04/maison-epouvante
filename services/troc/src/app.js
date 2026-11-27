import express from 'express';
import { createAuth } from '@maison-epouvante/auth';
import { errorHandler, notFoundHandler } from './http.js';
import { healthRouter } from './routes/health.js';
import { offersRouter } from './routes/offers.js';

/**
 * Builds the application without starting it (testable with Supertest).
 * @param {object} deps
 * @param {object} deps.store Offer store, from createOfferStore() (src/stores).
 * @param {{ publish: Function }} deps.publisher Created by createPublisher() from @maison-epouvante/messaging.
 * @param {object} [deps.auth] Authentication middleware, from @maison-epouvante/auth.
 */
export function createApp({ store, publisher, auth = createAuth() }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter());
  app.use('/offers', offersRouter({ store, auth, publisher }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
