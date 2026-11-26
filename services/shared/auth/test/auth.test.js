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
  it('rejects an unknown provider', () => {
    expect(() => createAuth({ provider: 'ldap' })).toThrow(/Unknown SSO/);
  });

  it('refuses the none mode in production', () => {
    expect(() => createAuth({ provider: 'none', nodeEnv: 'production' })).toThrow(/forbidden/);
  });

  it('reports providers not implemented yet', () => {
    expect(() => createAuth({ provider: 'keycloak', nodeEnv: 'test' })).toThrow(/Lot 3/);
  });
});

describe('none mode', () => {
  const app = buildApp(createAuth({ provider: 'none', nodeEnv: 'test' }));

  it('provides a development user with every role', async () => {
    const res = await request(app).get('/moderateur');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'dev-membre',
      roles: ['membre', 'moderateur'],
      provider: 'none',
    });
  });

  it('reads the id and roles from the development headers', async () => {
    const res = await request(app)
      .get('/membre')
      .set('X-Dev-User', 'm-042')
      .set('X-Dev-Roles', 'membre');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('m-042');
  });

  it('returns 403 when the role is missing', async () => {
    const res = await request(app).get('/moderateur').set('X-Dev-Roles', 'membre');
    expect(res.status).toBe(403);
    expect(res.body.erreur.code).toBe('ROLE_MANQUANT');
  });

  it('adds the Server-Timing header', async () => {
    const res = await request(app).get('/membre');
    expect(res.headers['server-timing']).toMatch(/^auth;dur=\d+(\.\d+)?$/);
  });
});
