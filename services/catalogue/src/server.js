import { createApp } from './app.js';
import { createProductStore } from './stores/index.js';

const port = Number(process.env.PORT ?? 3001);
const store = await createProductStore();

const server = createApp({ store }).listen(port, () => {
  console.log(
    `[catalogue] listening on port ${port} (SSO=${process.env.SSO ?? 'none'}, STORE=${process.env.STORE ?? 'memory'})`,
  );
});

// Graceful shutdown: finish in-flight requests, then release the database connections.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => store.close().finally(() => process.exit(0))));
}
