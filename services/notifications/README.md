# Service Notifications — Lot 4

Prévient les membres quand une offre de troc correspond à leurs centres d'intérêt. Port 3003. Détails : [`docs/lots/lot-4-brokers.md`](../../docs/lots/lot-4-brokers.md).

| Route                | Accès    | Réponse                                                                |
| -------------------- | -------- | ---------------------------------------------------------------------- |
| `GET /health`        | public   | état du service                                                        |
| `GET /notifications` | `membre` | les notifications du membre ; un `moderateur` voit tout (`?membreId=`) |

Consomme `offer.created` (groupe `notifications`). Centres d'intérêt : `data/interests.json`.

**Idempotence** : un événement déjà traité (même `id`) est ignoré, car les brokers livrent « au moins une fois ».

**Stockage** : `STORE=memory` (défaut, tests et développement) ou `STORE=postgres` avec `NOTIFICATIONS_DATABASE_URL`. Tables : `db/schema.sql`, créées au démarrage.

```bash
npm run dev -w services/notifications
npm test -w services/notifications
```
