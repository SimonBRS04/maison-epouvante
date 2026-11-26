import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createAuth } from '@maison-epouvante/auth';
import { createApp } from '../src/app.js';
import { createNotificationStore } from '../src/store.js';

const auth = createAuth({ provider: 'none', nodeEnv: 'test' });

let app;
beforeEach(() => {
  const store = createNotificationStore();
  store.add({ membreId: 'm-001', offerId: 'o-1', titre: 'A', categorie: 'bd' });
  store.add({ membreId: 'm-002', offerId: 'o-2', titre: 'B', categorie: 'bd' });
  app = createApp({ auth, store });
});

describe('GET /notifications', () => {
  it('un membre ne voit que ses notifications', async () => {
    const res = await request(app)
      .get('/notifications?membreId=m-002')
      .set('X-Dev-User', 'm-001')
      .set('X-Dev-Roles', 'membre');
    expect(res.status).toBe(200);
    expect(res.body.map((n) => n.membreId)).toEqual(['m-001']);
  });

  it('un modérateur voit tout', async () => {
    const res = await request(app).get('/notifications');
    expect(res.body).toHaveLength(2);
  });

  it('un modérateur peut filtrer par membre', async () => {
    const res = await request(app).get('/notifications?membreId=m-002');
    expect(res.body.map((n) => n.membreId)).toEqual(['m-002']);
  });
});

describe('GET /health', () => {
  it('répond au format du socle', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ status: 'ok', service: 'notifications', version: '0.1.0' });
  });
});
