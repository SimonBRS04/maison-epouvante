export const CATEGORIES = ['figurines', 'blu-ray', 'bd', 'jeux', 'goodies', 'fanzine'];
export const OFFER_TYPES = ['echange', 'don'];

/**
 * Validates the body of a new offer. The membreId never comes from the body (it comes from the token).
 * Error messages are returned to API clients, hence in French.
 * @returns {{ value?: object, error?: string }}
 */
export function validateOffer(body) {
  const { titre, description = '', type, categorie } = body ?? {};
  if (typeof titre !== 'string' || titre.trim().length < 3 || titre.trim().length > 80) {
    return { error: '"titre" doit faire entre 3 et 80 caractères.' };
  }
  if (typeof description !== 'string' || description.length > 500) {
    return { error: '"description" doit faire 500 caractères au plus.' };
  }
  if (!OFFER_TYPES.includes(type)) {
    return { error: `"type" doit valoir : ${OFFER_TYPES.join(', ')}.` };
  }
  if (!CATEGORIES.includes(categorie)) {
    return { error: `"categorie" doit valoir : ${CATEGORIES.join(', ')}.` };
  }
  return { value: { titre: titre.trim(), description, type, categorie } };
}
