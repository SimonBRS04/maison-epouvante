/**
 * Shared authentication module — owner: Lot 3.
 *
 * Frozen interface (see docs/lots/lot-3-sso.md):
 *   const auth = createAuth({ provider, issuer, audience, jwksUri });
 *   app.post('/route', auth.requireRole('membre'), handler);  // req.user = { id, roles, provider }
 *
 * Skeleton status: only the `none` mode is implemented.
 * The `keycloak` and `auth0` modes are to be implemented by Lot 3 (verification with `jose`).
 * Error messages sent to API clients stay in French; developer-facing errors are in English.
 */
import { createNoneVerifier } from './providers/none.js';

const PROVIDERS = ['none', 'keycloak', 'auth0'];

/**
 * Creates the authentication middleware.
 * @param {object} options
 * @param {'none'|'keycloak'|'auth0'} [options.provider]
 * @param {string} [options.issuer]
 * @param {string} [options.audience]
 * @param {string} [options.jwksUri]
 * @param {string} [options.nodeEnv] NODE_ENV value (injectable for tests).
 */
export function createAuth({
  provider = process.env.SSO ?? 'none',
  issuer = process.env.SSO_ISSUER,
  audience = process.env.SSO_AUDIENCE,
  jwksUri = process.env.SSO_JWKS_URI,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`Unknown SSO "${provider}". Allowed values: ${PROVIDERS.join(', ')}.`);
  }
  if (provider === 'none' && nodeEnv === 'production') {
    throw new Error('SSO=none is forbidden when NODE_ENV=production.');
  }

  const verifier = selectVerifier(provider, { issuer, audience, jwksUri });

  /** Checks the identity and sets req.user; answers 401 otherwise. */
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

  /** Like requireAuth, then requires the given role; answers 403 if it is missing. */
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
  // TODO Lot 3: implement JWT verification (jose, JWKS, issuer, audience, role extraction).
  throw new Error(`SSO provider "${provider}": to be implemented by Lot 3.`);
}

/** Authentication error carrying the code sent back to the client. */
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
