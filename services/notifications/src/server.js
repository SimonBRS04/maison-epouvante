import { createSubscriber } from '@maison-epouvante/messaging';
import { createApp } from './app.js';
import { createNotifier } from './notifier.js';
import { createNotificationStore } from './store.js';

const port = Number(process.env.PORT ?? 3003);
const store = createNotificationStore();
const notifier = createNotifier({ store });

const subscriber = await createSubscriber({ group: 'notifications' });
await subscriber.subscribe('offers', async (event) => {
  const created = notifier.handle(event);
  console.log(`[notifications] ${event.type} ${event.id} → ${created.length} notification(s)`);
});

const server = createApp({ store }).listen(port, () => {
  console.log(
    `[notifications] à l'écoute sur le port ${port} (SSO=${process.env.SSO ?? 'none'}, BROKER=${process.env.BROKER ?? 'memory'})`,
  );
});

// Arrêt propre : se désabonner du broker avant de quitter.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => subscriber.close().finally(() => process.exit(0))));
}
