import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createAuth } from '@maison-epouvante/auth';
import { createApp } from '../src/app.js';
import { createOfferStore } from '../src/store.js';

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
  app = createApp({ auth, publisher, store: createOfferStore(structuredClone(seed)) });
});

describe('GET /offers', () => {
  it('liste toutes les offres', async () => {
    const res = await request(app).get('/offers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filtre par catégorie', async () => {
    const res = await request(app).get('/offers?categorie=fanzine');
    expect(res.body.map((o) => o.id)).toEqual(['o-0002']);
  });
});

describe('GET /offers/:id', () => {
  it('répond 404 pour une offre inconnue', async () => {
    const res = await request(app).get('/offers/o-9999');
    expect(res.status).toBe(404);
  });
});

describe('POST /offers', () => {
  it('crée l’offre au nom du membre connecté et publie offer.created', async () => {
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

  it('ignore un membreId envoyé dans le corps', async () => {
    const res = await request(app)
      .post('/offers')
      .set('X-Dev-User', 'm-042')
      .send({ ...newOffer, membreId: 'm-usurpe' });
    expect(res.body.membreId).toBe('m-042');
  });

  it('répond 400 pour un type inconnu', async () => {
    const res = await request(app)
      .post('/offers')
      .send({ ...newOffer, type: 'vente' });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('VALIDATION');
  });

  it('répond 403 sans le rôle membre', async () => {
    const res = await request(app).post('/offers').set('X-Dev-Roles', 'visiteur').send(newOffer);
    expect(res.status).toBe(403);
  });

  it('répond 503 et ne garde pas l’offre si la publication échoue', async () => {
    publisher.publish.mockRejectedValueOnce(new Error('broker injoignable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).post('/offers').send(newOffer);

    expect(res.status).toBe(503);
    expect(res.body.erreur.code).toBe('MESSAGERIE_INDISPONIBLE');
    expect((await request(app).get('/offers')).body).toHaveLength(2);
  });
});

describe('GET /health', () => {
  it('répond au format du socle', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ status: 'ok', service: 'troc', version: '0.1.0' });
  });
});
