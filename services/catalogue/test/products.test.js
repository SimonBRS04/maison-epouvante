import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createAuth } from '@maison-epouvante/auth';
import { createApp } from '../src/app.js';
import { createProductStore } from '../src/store.js';

const auth = createAuth({ provider: 'none', nodeEnv: 'test' });
const seed = [
  {
    id: 'p-001',
    nom: 'Figurine',
    categorie: 'figurines',
    prix: 4990,
    stock: 3,
    exclusifEnLigne: true,
  },
  {
    id: 'p-002',
    nom: 'Blu-ray',
    categorie: 'blu-ray',
    prix: 2990,
    stock: 5,
    exclusifEnLigne: false,
  },
];
const newProduct = { nom: 'Mug', categorie: 'goodies', prix: 1290, stock: 10 };

let app;
beforeEach(() => {
  app = createApp({ auth, store: createProductStore(structuredClone(seed)) });
});

describe('GET /products', () => {
  it('liste tous les produits', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filtre par catégorie', async () => {
    const res = await request(app).get('/products?categorie=blu-ray');
    expect(res.body.map((p) => p.id)).toEqual(['p-002']);
  });
});

describe('GET /products/:id', () => {
  it('renvoie le produit', async () => {
    const res = await request(app).get('/products/p-001');
    expect(res.status).toBe(200);
    expect(res.body.nom).toBe('Figurine');
  });

  it('répond 404 pour un produit inconnu', async () => {
    const res = await request(app).get('/products/p-999');
    expect(res.status).toBe(404);
    expect(res.body.erreur.code).toBe('INTROUVABLE');
  });
});

describe('POST /products', () => {
  it('crée un produit pour un modérateur', async () => {
    const res = await request(app).post('/products').send(newProduct);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'p-003', ...newProduct, exclusifEnLigne: false });
  });

  it('répond 403 pour un simple membre', async () => {
    const res = await request(app).post('/products').set('X-Dev-Roles', 'membre').send(newProduct);
    expect(res.status).toBe(403);
  });

  it('répond 400 si le prix n’est pas un entier en centimes', async () => {
    const res = await request(app)
      .post('/products')
      .send({ ...newProduct, prix: 12.9 });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('VALIDATION');
  });

  it('répond 400 sur un JSON mal formé', async () => {
    const res = await request(app)
      .post('/products')
      .set('Content-Type', 'application/json')
      .send('{ "nom": ');
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('JSON_INVALIDE');
  });
});

describe('DELETE /products/:id', () => {
  it('retire un produit', async () => {
    const res = await request(app).delete('/products/p-001');
    expect(res.status).toBe(204);
    expect((await request(app).get('/products/p-001')).status).toBe(404);
  });

  it('répond 404 pour un produit inconnu', async () => {
    expect((await request(app).delete('/products/p-999')).status).toBe(404);
  });
});

describe('GET /health', () => {
  it('répond au format du socle', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'catalogue', version: '0.1.0' });
  });
});
