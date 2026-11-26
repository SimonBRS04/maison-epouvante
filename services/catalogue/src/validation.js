export const CATEGORIES = ['figurines', 'blu-ray', 'bd', 'jeux', 'goodies', 'fanzine'];

/**
 * Validates the body of a new product. Error messages are returned to API clients, hence in French.
 * @returns {{ value?: object, error?: string }}
 */
export function validateProduct(body) {
  const { nom, categorie, prix, stock, exclusifEnLigne = false } = body ?? {};
  if (typeof nom !== 'string' || nom.trim().length < 2 || nom.trim().length > 120) {
    return { error: '"nom" doit faire entre 2 et 120 caractères.' };
  }
  if (!CATEGORIES.includes(categorie)) {
    return { error: `"categorie" doit valoir : ${CATEGORIES.join(', ')}.` };
  }
  if (!Number.isInteger(prix) || prix < 0) {
    return { error: '"prix" doit être un entier positif, en centimes.' };
  }
  if (!Number.isInteger(stock) || stock < 0) {
    return { error: '"stock" doit être un entier positif.' };
  }
  if (typeof exclusifEnLigne !== 'boolean') {
    return { error: '"exclusifEnLigne" doit être un booléen.' };
  }
  return { value: { nom: nom.trim(), categorie, prix, stock, exclusifEnLigne } };
}
