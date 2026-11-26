import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAuth } from '../src/index.js';

function buildApp(auth) {
  const app = express();
  app.get('/membre', auth.requireRole('membre'), (req, res) => res.json(req.user));
  app.get('/moderateur', auth.requireRole('moderateur'), (req, res) => res.json(req.user));
  return app;
}

describe('createAuth', () => {
  it('refuse un fournisseur inconnu', () => {
    expect(() => createAuth({ provider: 'ldap' })).toThrow(/inconnu/);
  });

  it('refuse le mode none en production', () => {
    expect(() => createAuth({ provider: 'none', nodeEnv: 'production' })).toThrow(/interdit/);
  });

  it('signale les fournisseurs pas encore implémentés', () => {
    expect(() => createAuth({ provider: 'keycloak', nodeEnv: 'test' })).toThrow(/Lot 3/);
  });
});

describe('mode none', () => {
  const app = buildApp(createAuth({ provider: 'none', nodeEnv: 'test' }));

  it('fournit un utilisateur de développement avec tous les rôles', async () => {
    const res = await request(app).get('/moderateur');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'dev-membre',
      roles: ['membre', 'moderateur'],
      provider: 'none',
    });
  });

  it("prend l'identifiant et les rôles dans les en-têtes de développement", async () => {
    const res = await request(app)
      .get('/membre')
      .set('X-Dev-User', 'm-042')
      .set('X-Dev-Roles', 'membre');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('m-042');
  });

  it('répond 403 si le rôle manque', async () => {
    const res = await request(app).get('/moderateur').set('X-Dev-Roles', 'membre');
    expect(res.status).toBe(403);
    expect(res.body.erreur.code).toBe('ROLE_MANQUANT');
  });

  it("ajoute l'en-tête Server-Timing", async () => {
    const res = await request(app).get('/membre');
    expect(res.headers['server-timing']).toMatch(/^auth;dur=\d+(\.\d+)?$/);
  });
});
