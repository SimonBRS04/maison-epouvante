# La Petite Maison de l'Épouvante — POC et comparatifs (BLOC 3)

Un POC de 3 microservices sert de terrain d'essai à 3 comparatifs de technologies, mesurés par des bancs de test automatisés et affichés dans un dashboard.

| Comparatif | Techno A       | Techno B | Lot   |
| ---------- | -------------- | -------- | ----- |
| CI/CD      | GitHub Actions | TeamCity | Lot 2 |
| SSO        | Keycloak       | Auth0    | Lot 3 |
| Brokers    | Kafka          | RabbitMQ | Lot 4 |
| Dashboard  | —              | —        | Lot 1 |

## À lire en premier

1. [`docs/socle-commun.md`](docs/socle-commun.md) — architecture, conventions, contrat de résultats (fait foi)
2. [`CONTRIBUTING.md`](CONTRIBUTING.md) — règles Git et GitHub de l'équipe
3. Le fichier de ton lot dans [`docs/lots/`](docs/lots/)

## Démarrer

Prérequis : Node.js 22, Docker Desktop.

```bash
npm ci
cp .env.example .env        # puis remplir ; .env n'est jamais commité
npm run lint
npm test
```

Lancer un service en local (mode développement : `SSO=none`, `BROKER=memory`) :

```bash
npm run start:catalogue      # http://localhost:3001/products
npm run start:troc           # http://localhost:3002/offers
npm run start:notifications  # http://localhost:3003/notifications
```

Construire une image (toujours depuis la racine) :

```bash
docker build -f services/troc/Dockerfile -t maison-epouvante-troc .
```

Les images démarrent en `NODE_ENV=production`, où `SSO=none` est refusé : passer `SSO` (et ses URL) ou `NODE_ENV=test`.

## Arborescence

```
services/      catalogue · troc · notifications · shared/auth · shared/messaging
bench/         cicd · sso · brokers           (bancs de test)
infra/         poc · cicd · sso · brokers     (fichiers docker compose)
dashboard/     affichage des résultats
packages/      bench-kit                      (outils communs des bancs)
results/       résultats officiels            (contrat v1)
fixtures/      exemples de résultats, un par comparatif
docs/          socle commun, fichiers de lots, schémas de la soutenance
```
