import { createSubscriber } from '@maison-epouvante/messaging';
import { createApp } from './app.js';
import { createNotifier } from './notifier.js';
import { createNotificationStore } from './stores/index.js';

const port = Number(process.env.PORT ?? 3003);
const store = await createNotificationStore();
const notifier = createNotifier({ store });

const subscriber = await createSubscriber({ group: 'notifications' });
await subscriber.subscribe('offers', async (event) => {
  const created = await notifier.handle(event);
  console.log(`[notifications] ${event.type} ${event.id} → ${created.length} notification(s)`);
});

const server = createApp({ store }).listen(port, () => {
  console.log(
    `[notifications] listening on port ${port} (SSO=${process.env.SSO ?? 'none'}, BROKER=${process.env.BROKER ?? 'memory'}, STORE=${process.env.STORE ?? 'memory'})`,
  );
});

// Graceful shutdown: stop consuming, finish in-flight requests, then release the database.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () =>
    server.close(() =>
      Promise.allSettled([subscriber.close(), store.close()]).finally(() => process.exit(0)),
    ),
  );
}
