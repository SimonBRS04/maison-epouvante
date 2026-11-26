/** HTTP helpers: error format from the shared conventions, 404, unexpected errors. */

export function sendError(res, status, code, message) {
  return res.status(status).json({ erreur: { code, message } });
}

export function notFoundHandler(_req, res) {
  return sendError(res, 404, 'INTROUVABLE', 'Route inconnue.');
}

// Express recognises an error handler by its 4 parameters.
export function errorHandler(error, _req, res, _next) {
  if (error.type === 'entity.parse.failed') {
    return sendError(res, 400, 'JSON_INVALIDE', 'Le corps de la requête n’est pas du JSON valide.');
  }
  console.error(error);
  return sendError(res, 500, 'ERREUR_INTERNE', 'Erreur interne.');
}
