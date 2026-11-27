import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createAuth } from '@maison-epouvante/auth';
import { createApp } from '../src/app.js';
import { createMemoryOfferStore } from '../src/stores/memory.js';

const auth = createAuth({ provider: 'none', nodeEnv: 'test' });
const seed = [
  {
    id: 'o-0001',
    membreId: 'm-001',
    titre: 'Figurine',
    description: '',
    type: 'echange',
    categorie: 'figurines',
    creeA: '2026-11-20T18:02:00.000Z',
  },
  {
    id: 'o-0002',
    membreId: 'm-002',
    titre: 'Fanzines',
    description: '',
    type: 'don',
    categorie: 'fanzine',
    creeA: '2026-11-22T09:41:00.000Z',
  },
];
const newOffer = { titre: 'BD L’Orc tome 1', type: 'don', categorie: 'bd' };

let app;
let publisher;
beforeEach(() => {
  publisher = { publish: vi.fn(async () => {}) };
  app = createApp({
    auth,
    publisher,
    store: createMemoryOfferStore({ seed: structuredClone(seed) }),
  });
});

describe('GET /offers', () => {
  it('lists every offer', async () => {
    const res = await request(app).get('/offers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters by category', async () => {
    const res = await request(app).get('/offers?categorie=fanzine');
    expect(res.body.map((o) => o.id)).toEqual(['o-0002']);
  });
});

describe('GET /offers/:id', () => {
  it('returns 404 for an unknown offer', async () => {
    const res = await request(app).get('/offers/o-9999');
    expect(res.status).toBe(404);
  });
});

describe('POST /offers', () => {
  it('creates the offer on behalf of the logged-in member and publishes offer.created', async () => {
    const res = await request(app).post('/offers').set('X-Dev-User', 'm-042').send(newOffer);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'o-0003', membreId: 'm-042', ...newOffer });
    expect(publisher.publish).toHaveBeenCalledOnce();
    const [topic, event, options] = publisher.publish.mock.calls[0];
    expect(topic).toBe('offers');
    expect(options).toEqual({ key: 'm-042' });
    expect(event).toMatchObject({
      type: 'offer.created',
      membreId: 'm-042',
      payload: { offerId: 'o-0003', titre: newOffer.titre, type: 'don', categorie: 'bd' },
    });
  });

  it('ignores a membreId sent in the body', async () => {
    const res = await request(app)
      .post('/offers')
      .set('X-Dev-User', 'm-042')
      .send({ ...newOffer, membreId: 'm-usurpe' });
    expect(res.body.membreId).toBe('m-042');
  });

  it('returns 400 for an unknown type', async () => {
    const res = await request(app)
      .post('/offers')
      .send({ ...newOffer, type: 'vente' });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('VALIDATION');
  });

  it('returns 403 without the membre role', async () => {
    const res = await request(app).post('/offers').set('X-Dev-Roles', 'visiteur').send(newOffer);
    expect(res.status).toBe(403);
  });

  it('returns 503 and drops the offer when publishing fails', async () => {
    publisher.publish.mockRejectedValueOnce(new Error('broker injoignable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).post('/offers').send(newOffer);

    expect(res.status).toBe(503);
    expect(res.body.erreur.code).toBe('MESSAGERIE_INDISPONIBLE');
    expect((await request(app).get('/offers')).body).toHaveLength(2);
  });
});

describe('GET /health', () => {
  it('answers in the shared health format', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'troc', version: '0.1.0' });
  });
});
