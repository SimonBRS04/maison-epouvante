import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);

createApp().listen(port, () => {
  console.log(`[catalogue] listening on port ${port} (SSO=${process.env.SSO ?? 'none'})`);
});
