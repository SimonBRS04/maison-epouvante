import { createPublisher } from '@maison-epouvante/messaging';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3002);
const publisher = await createPublisher();

const server = createApp({ publisher }).listen(port, () => {
  console.log(
    `[troc] à l'écoute sur le port ${port} (SSO=${process.env.SSO ?? 'none'}, BROKER=${process.env.BROKER ?? 'memory'})`,
  );
});

// Arrêt propre : fermer la connexion au broker avant de quitter.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => publisher.close().finally(() => process.exit(0))));
}
