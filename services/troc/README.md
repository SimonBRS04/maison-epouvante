# Service Troc — Lot 2

Offres d'échange et de don entre membres. Port 3002. Détails : [`docs/lots/lot-2-cicd.md`](../../docs/lots/lot-2-cicd.md).

| Route             | Accès    | Réponse                                                         |
| ----------------- | -------- | --------------------------------------------------------------- |
| `GET /health`     | public   | état du service                                                 |
| `GET /offers`     | public   | liste, filtre `?categorie=`                                     |
| `GET /offers/:id` | public   | une offre, `404` sinon                                          |
| `POST /offers`    | `membre` | `201` + l'offre et publication de `offer.created`, `400`, `503` |

Le `membreId` vient du jeton, jamais du corps.

**Choix documenté** : si la publication de `offer.created` échoue, l'offre n'est pas créée (réponse `503`), pour ne jamais avoir d'offre sans notification possible.

```bash
npm run dev -w services/troc
npm test -w services/troc
```
