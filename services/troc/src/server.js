import { createPublisher } from '@maison-epouvante/messaging';
import { createApp } from './app.js';
import { createOfferStore } from './stores/index.js';

const port = Number(process.env.PORT ?? 3002);
const store = await createOfferStore();
const publisher = await createPublisher();

const server = createApp({ store, publisher }).listen(port, () => {
  console.log(
    `[troc] listening on port ${port} (SSO=${process.env.SSO ?? 'none'}, BROKER=${process.env.BROKER ?? 'memory'}, STORE=${process.env.STORE ?? 'memory'})`,
  );
});

// Graceful shutdown: finish in-flight requests, then close the broker and database connections.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () =>
    server.close(() =>
      Promise.allSettled([publisher.close(), store.close()]).finally(() => process.exit(0)),
    ),
  );
}
