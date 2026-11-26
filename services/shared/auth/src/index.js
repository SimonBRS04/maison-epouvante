/**
 * Module d'authentification partagé — propriétaire : Lot 3.
 *
 * Interface figée (voir docs/lots/lot-3-sso.md) :
 *   const auth = createAuth({ provider, issuer, audience, jwksUri });
 *   app.post('/route', auth.requireRole('membre'), handler);  // req.user = { id, roles, provider }
 *
 * État du squelette : seul le mode `none` est implémenté.
 * Les modes `keycloak` et `auth0` sont à implémenter par le Lot 3 (vérification avec `jose`).
 */
import { createNoneVerifier } from './providers/none.js';

const PROVIDERS = ['none', 'keycloak', 'auth0'];

/**
 * Crée le middleware d'authentification.
 * @param {object} options
 * @param {'none'|'keycloak'|'auth0'} [options.provider]
 * @param {string} [options.issuer]
 * @param {string} [options.audience]
 * @param {string} [options.jwksUri]
 * @param {string} [options.nodeEnv] Valeur de NODE_ENV (injectable pour les tests).
 */
export function createAuth({
  provider = process.env.SSO ?? 'none',
  issuer = process.env.SSO_ISSUER,
  audience = process.env.SSO_AUDIENCE,
  jwksUri = process.env.SSO_JWKS_URI,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`SSO inconnu : "${provider}". Valeurs possibles : ${PROVIDERS.join(', ')}.`);
  }
  if (provider === 'none' && nodeEnv === 'production') {
    throw new Error('SSO=none est interdit quand NODE_ENV=production.');
  }

  const verifier = selectVerifier(provider, { issuer, audience, jwksUri });

  /** Vérifie l'identité et place req.user ; répond 401 sinon. */
  function requireAuth() {
    return async (req, res, next) => {
      const start = performance.now();
      try {
        req.user = await verifier.verify(req);
      } catch (error) {
        return sendAuthError(res, error);
      } finally {
        res.setHeader('Server-Timing', `auth;dur=${(performance.now() - start).toFixed(2)}`);
      }
      return next();
    };
  }

  /** Comme requireAuth, puis exige le rôle demandé ; répond 403 s'il manque. */
  function requireRole(role) {
    const authenticate = requireAuth();
    return (req, res, next) =>
      authenticate(req, res, () => {
        if (!req.user.roles.includes(role)) {
          return res
            .status(403)
            .json({ erreur: { code: 'ROLE_MANQUANT', message: `Rôle requis : ${role}.` } });
        }
        return next();
      });
  }

  return { provider, requireAuth, requireRole };
}

function selectVerifier(provider, _options) {
  if (provider === 'none') return createNoneVerifier();
  // TODO Lot 3 : implémenter la vérification JWT (jose, JWKS, issuer, audience, extraction des rôles).
  throw new Error(`Fournisseur SSO "${provider}" : à implémenter par le Lot 3.`);
}

/** Erreur d'authentification portant le code renvoyé au client. */
export class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function sendAuthError(res, error) {
  if (error instanceof AuthError) {
    return res.status(401).json({ erreur: { code: error.code, message: error.message } });
  }
  return res
    .status(401)
    .json({ erreur: { code: 'JETON_INVALIDE', message: 'Jeton invalide ou expiré.' } });
}
