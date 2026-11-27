# Service Catalogue — Lot 3

Produits de la boutique. Port 3001. Détails : [`docs/lots/lot-3-sso.md`](../../docs/lots/lot-3-sso.md).

| Route                  | Accès        | Réponse                               |
| ---------------------- | ------------ | ------------------------------------- |
| `GET /health`          | public       | état du service                       |
| `GET /products`        | public       | liste, filtre `?categorie=`           |
| `GET /products/:id`    | public       | un produit, `404` sinon               |
| `POST /products`       | `moderateur` | `201` + le produit, `400` si invalide |
| `DELETE /products/:id` | `moderateur` | `204`, `404` sinon                    |

Prix en centimes (entier). Données de départ : `data/products.json`.

**Stockage** : `STORE=memory` (défaut, tests et développement) ou `STORE=postgres` avec `CATALOGUE_DATABASE_URL`. Tables : `db/schema.sql`, créées au démarrage.

```bash
npm run dev -w services/catalogue
npm test -w services/catalogue
```
