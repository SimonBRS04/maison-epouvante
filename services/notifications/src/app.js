import express from 'express';
import { createAuth } from '@maison-epouvante/auth';
import { errorHandler, notFoundHandler } from './http.js';
import { healthRouter } from './routes/health.js';
import { notificationsRouter } from './routes/notifications.js';

/** Crée l'application HTTP sans la démarrer (testable avec Supertest). */
export function createApp({ store, auth = createAuth() }) {
  const app = express();
  app.disable('x-powered-by');

  app.use('/health', healthRouter());
  app.use('/notifications', notificationsRouter({ store, auth }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
