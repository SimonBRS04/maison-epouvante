import { readFileSync } from 'node:fs';
import { Router } from 'express';

const { name, version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

export function healthRouter() {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ status: 'ok', service: name.split('/')[1], version });
  });
  return router;
}
