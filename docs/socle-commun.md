# Socle commun — à lire par les 4 membres

> Ce fichier est le contrat entre les 4 lots. Tant que chacun le respecte, tout s'emboîte sans attendre les autres.
> Si tu travailles avec une IA, donne-lui **ce fichier + le fichier de ton lot**, en entier.
> Toute modification de ce fichier passe par une pull request relue par toute l'équipe.

---

## 1. Le projet en 30 secondes

**Contexte (fictif, BLOC 3).** « La Petite Maison de l'Épouvante » veut une plateforme en ligne : boutique, fanzine numérique, espace de troc entre fans, notifications. Nous jouons l'équipe IT en phase préparatoire. La direction veut savoir **quelles technologies choisir et pourquoi**.

**Ce que le jury attend de nous** (grille d'évaluation) :

- une démonstration comparant **2 outils CI/CD** (3 points) ;
- une démonstration comparant **2 technologies pour l'application** (3 points) ;
- des schémas et explications : cycle DevSecOps, métiers, architecture, orchestrateur, tests, sécurité (14 points).

**Notre réponse.** Un petit POC « maison hantée » de 3 microservices sert de terrain d'essai à **3 comparatifs** :

| Comparatif | Techno A       | Techno B                         | Lot   |
| ---------- | -------------- | -------------------------------- | ----- |
| CI/CD      | GitHub Actions | TeamCity (Professional, gratuit) | Lot 2 |
| SSO        | Keycloak       | Auth0                            | Lot 3 |
| Brokers    | Kafka          | RabbitMQ                         | Lot 4 |

Chaque comparatif a un **banc de test** automatisé qui mesure, provoque des pannes et des attaques, puis écrit ses résultats dans un **format JSON commun**. Un **dashboard** (Lot 1) affiche les deux technos côte à côte, avec l'historique des lancements.

**Le but n'est pas de désigner un gagnant**, mais de faire ressortir des différences réelles et argumentées, même déjà connues : perte d'ordre des messages, jeton encore valide après révocation, secret qui passe le pipeline… Un résultat qui contredit notre hypothèse est une bonne nouvelle pour l'oral.

---

## 2. Qui s'occupe de quoi

| Lot           | Comparatif                    | Service du POC            | Autres dossiers                                                                                   |
| ------------- | ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| **1 — Simon** | Dashboard (pas de comparatif) | —                         | `dashboard/`, `packages/bench-kit/`, `results/schema.json`, `scripts/`, `lancer.bat`, `lancer.sh` |
| **2**         | CI/CD                         | `services/troc/`          | `.github/workflows/`, `.teamcity/`, `infra/cicd/`, `infra/poc/`, `bench/cicd/`                    |
| **3**         | SSO                           | `services/catalogue/`     | `services/shared/auth/`, `infra/sso/`, `bench/sso/`                                               |
| **4**         | Brokers                       | `services/notifications/` | `services/shared/messaging/`, `infra/brokers/`, `bench/brokers/`                                  |

Tout le monde a accès à tout le dépôt. Chacun travaille dans sa partie ; pour toucher à celle d'un autre, on prévient son responsable et on le met en relecteur de la pull request (voir `CONTRIBUTING.md`, §7).

---

## 3. Architecture

```
            ┌──────────────────────┐  ┌──────────────────┐  ┌───────────────────────┐
 technos    │ GitHub Actions       │  │ Keycloak · Auth0 │  │ Kafka · RabbitMQ      │
            │ TeamCity             │  │                  │  │                       │
            └──────────▲───────────┘  └────────▲─────────┘  └──────────▲────────────┘
                       │ pilote                │ pilote                │ pilote
            ┌──────────┴───────────┐  ┌────────┴─────────┐  ┌──────────┴────────────┐
 bancs      │ bench/cicd  (lot 2)  │  │ bench/sso (lot 3)│  │ bench/brokers (lot 4) │
            └──────────┬───────────┘  └────────┬─────────┘  └──────────┬────────────┘
                       │ écrit                 │ écrit                 │ écrit
            ┌──────────▼───────────────────────▼───────────────────────▼────────────┐
            │ results/<comparatif>/*.json   — contrat v1, vérifié par schema.json    │
            └──────────────────────────────────┬──────────────────────────────────────┘
                                               │ lit
                                  ┌────────────▼─────────────┐
                                  │ dashboard  (lot 1)       │──── lance les bancs
                                  └──────────────────────────┘

 POC : Troc ──offer.created──▶ broker ──▶ Notifications        Catalogue ◀── jeton SSO
```

Les bancs ne parlent **jamais** au dashboard directement : ils écrivent un fichier, le dashboard le lit. Chaque lot avance donc seul dès que le format est figé.

---

## 4. Stack et versions

| Sujet                 | Choix                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Langage               | JavaScript, modules ES (`"type": "module"`), **Node.js 22 LTS** (fixé par `.nvmrc` et `engines`) |
| API HTTP              | Express                                                                                          |
| Tests                 | Vitest + Supertest                                                                               |
| Qualité               | ESLint (règles recommandées) + Prettier, config unique à la racine                               |
| Conteneurs            | Docker + Docker Compose, un fichier compose par sujet dans `infra/`                              |
| Dashboard             | HTML, CSS, JavaScript sans framework, graphiques Chart.js (servi en local, pas de CDN)           |
| Validation du contrat | JSON Schema (draft 2020-12) + `ajv`                                                              |
| Analyse de code       | SonarQube Cloud (gratuit pour un dépôt public)                                                   |

Le dépôt est un **monorepo npm workspaces** : un seul `npm ci` à la racine installe tout.

---

## 5. Arborescence du dépôt

```
maison-epouvante/
├─ services/
│  ├─ catalogue/            lot 3
│  ├─ troc/                 lot 2
│  ├─ notifications/        lot 4
│  └─ shared/
│     ├─ auth/              lot 3 — vérification des jetons SSO
│     └─ messaging/         lot 4 — publication / consommation d'événements
├─ bench/
│  ├─ cicd/                 lot 2
│  ├─ sso/                  lot 3
│  └─ brokers/              lot 4
├─ infra/
│  ├─ poc/compose.yml       lot 2 — les 3 services ensemble
│  ├─ cicd/compose.yml      lot 2 — TeamCity
│  ├─ sso/compose.yml       lot 3 — Keycloak
│  └─ brokers/compose.yml   lot 4 — Kafka + RabbitMQ
├─ dashboard/               lot 1
├─ packages/
│  └─ bench-kit/            lot 1 — boîte à outils commune des 3 bancs
├─ results/
│  ├─ schema.json           lot 1 — le contrat
│  ├─ cicd/  sso/  brokers/ résultats officiels (versionnés)
├─ results-dev/             résultats de développement (ignorés par git)
├─ fixtures/                un fichier exemple par comparatif (chaque lot le sien)
├─ scripts/                 lot 1 — validate-results.js…
├─ docs/                    ce fichier, les fichiers de lots, les schémas de la soutenance
├─ .github/  .teamcity/     lot 2
├─ CONTRIBUTING.md
├─ lancer.bat  lancer.sh    lot 1
└─ package.json             workspaces + scripts racine
```

---

## 6. Conventions techniques communes

### Ports

| Service       | Port                 |
| ------------- | -------------------- |
| Dashboard     | 3000                 |
| Catalogue     | 3001                 |
| Troc          | 3002                 |
| Notifications | 3003                 |
| Keycloak      | 8080                 |
| TeamCity      | 8111                 |
| Kafka         | 9092                 |
| RabbitMQ      | 5672 (console 15672) |

### Variables d'environnement

Toutes déclarées dans `.env.example` (commité, valeurs vides ou par défaut). Les vraies valeurs sont dans `.env` (jamais commité).

| Variable                                     | Valeurs                             | Utilisée par            |
| -------------------------------------------- | ----------------------------------- | ----------------------- |
| `BROKER`                                     | `memory` · `kafka` · `rabbitmq`     | services, bench/brokers |
| `KAFKA_BROKERS`                              | `localhost:9092`                    | messaging               |
| `RABBITMQ_URL`                               | `amqp://guest:guest@localhost:5672` | messaging               |
| `SSO`                                        | `none` · `keycloak` · `auth0`       | services, bench/sso     |
| `SSO_ISSUER`, `SSO_AUDIENCE`, `SSO_JWKS_URI` | URL du fournisseur                  | auth                    |
| `PORT`                                       | voir tableau des ports              | chaque service          |

`SSO=none` (pas de vérification de jeton) et `BROKER=memory` (pas de vrai broker) servent **uniquement** au développement et aux tests unitaires. Le code doit refuser `SSO=none` quand `NODE_ENV=production`.

### Règles pour les 3 services

- Routes en anglais, au pluriel : `/products`, `/offers`, `/notifications`.
- Toujours une route `GET /health` qui renvoie `200 { "status": "ok", "service": "<nom>", "version": "<version du package.json>" }`.
- Erreurs au format `{ "erreur": { "code": "VALIDATION", "message": "…" } }` avec le bon code HTTP (400, 401, 403, 404, 500).
- Structure interne identique :
  ```
  services/<nom>/
  ├─ src/
  │  ├─ app.js        crée l'app Express (exportée, sans listen → testable)
  │  ├─ server.js     lit l'env, appelle app.listen
  │  ├─ routes/
  │  └─ store.js      données en mémoire
  ├─ test/            un fichier de test par route
  ├─ data/            données de départ (JSON)
  ├─ Dockerfile
  └─ package.json
  ```
- Dockerfile : image `node:24-alpine`, `npm ci --omit=dev`, `USER node` (jamais root), `HEALTHCHECK` sur `/health`.
- Au moins un test Vitest + Supertest par route, cas d'erreur compris.

### Événement `offer.created`

Publié par Troc, consommé par Notifications, utilisé par le banc Brokers.

```json
{
  "id": "uuid v4",
  "type": "offer.created",
  "envoyeA": "2026-12-01T14:30:00.123Z",
  "membreId": "m-042",
  "payload": {
    "offerId": "o-1234",
    "titre": "Figurine Orc édition festival",
    "type": "echange",
    "categorie": "figurines"
  }
}
```

Le banc Brokers ajoute un champ `seq` (numéro de séquence) pour mesurer l'ordre.

---

## 7. Règles communes aux 3 bancs

### Équité des mesures

1. Une seule techno tourne pendant qu'on la mesure : le banc démarre A, mesure, arrête A, puis fait de même pour B.
2. Ressources Docker identiques pour les deux technos : `cpus: "2"` et `mem_limit: 2g`.
3. Chaque mesure est répétée **5 fois** (réglable) après un tour d'échauffement non compté. On garde la médiane, le minimum et le maximum. (Exception : CI/CD, 1 à froid + 3 avec cache.)
4. Configuration par défaut pour les deux technos. Tout réglage est documenté et testé dans un scénario séparé.
5. Les résultats montrés à l'oral sont tous produits sur **le PC de démo**.
6. Quand une différence vient de l'environnement et non de la techno (Auth0 est sur internet, Keycloak en local), le banc la mesure aussi et la publie.

### Structure d'un banc

```
bench/<comparatif>/
├─ README.md       protocole, hypothèses de départ, limites connues
├─ index.js        point d'entrée : enchaîne tout, écrit le JSON
├─ mesures/        un fichier par mesure
├─ scenarios/      un fichier par scénario
└─ lib/            démarrer/arrêter les technos, chronomètre, statistiques
```

### Exécution

Résumé en une page, avec le schéma du bouton « Lancer » : [`bench/README.md`](../bench/README.md). Les commandes `npm run bench:cicd`, `bench:sso` et `bench:brokers` sont déjà déclarées et pointent vers `bench/<comparatif>/index.js`.

- **Boîte à outils commune** : chaque banc importe `@maison-epouvante/bench-kit` (Lot 1) au lieu de réécrire ces fonctions :

  | Fonction                                    | Rôle                                                                                                                                |
  | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
  | `parseArgs()`                               | lit `--rapide`, `--officiel`, `--collecte-seule`, `--repetitions` ; renvoie `{ official, quick, collectOnly, repetitions, warmup }` |
  | `step(texte)`                               | écrit la ligne `ETAPE=…`                                                                                                            |
  | `measure(fn, { repetitions, warmup })`      | lance une mesure plusieurs fois, renvoie `{ mediane, min, max }`                                                                    |
  | `percentile(valeurs, p)`, `median(valeurs)` | statistiques                                                                                                                        |
  | `environment()`                             | remplit le bloc `environnement` (machine, OS, CPU, RAM, commit)                                                                     |
  | `writeResult(json, { official })`           | valide le JSON, l'écrit de façon atomique au bon endroit, affiche `RESULTAT=…`, gère les rejets et le code de sortie                |

- Le banc tourne sur la machine hôte (Node.js), pas dans un conteneur : il pilote les technos avec `docker compose` / `docker kill` / `docker start`.
- Commande : `npm run bench:<comparatif>` à la racine.
  - `--rapide` : 1 répétition, volumes réduits (développement).
  - `--officiel` : écrit dans `results/` (versionné). Sans cette option, écrit dans `results-dev/` (ignoré par git).
- Pendant l'exécution, une ligne `ETAPE=<texte court>` sur la sortie standard à chaque étape (le dashboard les affiche).
- À la fin, dernière ligne : `RESULTAT=<chemin du fichier JSON>`.
- Codes de sortie : `0` OK · `1` le banc a planté · `2` JSON invalide.
- Un scénario qui plante ne fait pas planter le banc : l'erreur va dans `erreurs` et le banc continue.
- **Écriture atomique** : écrire `xxx.json.tmp`, puis renommer en `xxx.json` (le dashboard ne lit jamais un fichier à moitié écrit).
- Un scénario est qualifié par ce qu'on **observe**, jamais par ce qu'on attendait.

### Un banc est terminé quand

- [ ] `npm run bench:<comparatif> -- --officiel` passe de bout en bout sur le PC de démo ;
- [ ] le JSON est validé par le schéma (`npm run validate:results`) ;
- [ ] au moins 2 lancements officiels sont dans `results/<comparatif>/` ;
- [ ] chaque scénario a un statut pour les deux technos ;
- [ ] le README donne protocole, hypothèses et limites.

---

## 8. Le contrat de résultats v1

Un lancement = un fichier `results/<comparatif>/AAAA-MM-JJTHH-mm-ssZ.json` (ou `results-dev/…`). Toujours cette forme :

```json
{
  "version": 1,
  "comparatif": "brokers",
  "date": "2026-12-01T14:30:00Z",
  "duree_s": 0,
  "environnement": {
    "machine": "pc-demo",
    "os": "Windows 11",
    "cpu": "…",
    "ram_go": 0,
    "commit": "a1b2c3d"
  },
  "technos": [
    { "id": "kafka", "nom": "Kafka", "version": "…" },
    { "id": "rabbitmq", "nom": "RabbitMQ", "version": "…" }
  ],
  "mesures": [
    {
      "id": "latence_p95",
      "libelle": "Latence p95",
      "categorie": "Performance",
      "unite": "ms",
      "meilleur": "bas",
      "repetitions": 5,
      "valeurs": {
        "kafka": { "mediane": 0, "min": 0, "max": 0 },
        "rabbitmq": { "mediane": 0, "min": 0, "max": 0 }
      }
    }
  ],
  "scenarios": [
    {
      "id": "panne_broker_defaut",
      "libelle": "Panne du broker en plein envoi",
      "categorie": "Fiabilité",
      "attendu": "Aucun message perdu",
      "resultats": {
        "kafka": { "statut": "OK", "constat": "…", "valeur": 0, "unite": "messages perdus" },
        "rabbitmq": { "statut": "KO", "constat": "…", "valeur": 0, "unite": "messages perdus" }
      }
    }
  ],
  "erreurs": []
}
```

### Règles de remplissage

| Champ                            | Règle                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `version`                        | `1`                                                                                                                               |
| `comparatif`                     | `cicd` · `sso` · `brokers`                                                                                                        |
| `technos[].id`                   | `github_actions`, `teamcity`, `keycloak`, `auth0`, `kafka`, `rabbitmq`. L'ordre du tableau = l'ordre d'affichage (gauche, droite) |
| `mesures[].id`, `scenarios[].id` | snake_case, sans accent, **jamais renommé après le J4** (l'historique s'appuie dessus)                                            |
| `categorie`                      | `Performance` · `Durée par étape` · `Ressources` · `Fiabilité` · `Sécurité` · `Exploitation`                                      |
| `unite`                          | `ms` · `s` · `msg/s` · `Mo` · `%` · `nombre` · `lignes`                                                                           |
| `meilleur`                       | `bas` ou `haut` : quelle valeur gagne                                                                                             |
| `valeurs.<techno>`               | `{ "mediane", "min", "max" }`, ou `null` accompagné de `"note": "…"` sur la mesure si elle ne s'applique pas (mémoire d'Auth0…)   |
| `statut`                         | `OK` comportement sain · `KO` problème constaté · `PARTIEL` · `NA` non applicable                                                 |
| `constat`                        | Une phrase factuelle de 120 caractères au plus : ce qu'on a observé, pas ce qu'on en pense                                        |
| `valeur`, `unite` (scénario)     | Facultatifs : le chiffre qui résume l'observation                                                                                 |
| `erreurs`                        | `[{ "etape": "…", "message": "…" }]` : pannes du banc lui-même, pas des technos                                                   |

### Validation

- Le contrat est écrit dans `results/schema.json` (Lot 1).
- Chaque banc écrit son résultat avec `writeResult()` de `bench-kit`, qui le valide **avant** de l'écrire. Invalide → fichier rangé dans `results/<comparatif>/rejets/`, sortie avec le code 2.
- `npm run validate:results` vérifie tous les résultats et toutes les fixtures. Cette étape tourne aussi dans les pipelines.

### Ce qui peut changer, et comment

- **Ajouter** une mesure ou un scénario : libre, à condition de mettre à jour sa fixture le jour même.
- **Renommer** un `id` : interdit après le J4.
- **Changer la forme** du JSON : pull request relue par Simon, `version` augmentée de 1.

---

## 9. Jalons communs

| Quand  | Qui                                         | Livrable                                                                                                       |
| ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Fin J1 | Simon, relu par tous                        | `results/schema.json` v1 validé ensemble, et `packages/bench-kit` utilisable                                   |
| Fin J1 | Tous                                        | Dépôt cloné, `npm ci` et `npm run lint` passent chez chacun                                                    |
| Fin J2 | Lot 4                                       | `services/shared/messaging` avec l'adaptateur `memory` (les autres en dépendent) — **livré dans le squelette** |
| Fin J2 | Lot 3                                       | `services/shared/auth` avec le mode `none` (les autres en dépendent) — **livré dans le squelette**             |
| Fin J2 | Chaque lot 2, 3, 4                          | `fixtures/<comparatif>.json` : la vraie liste de ses mesures et scénarios, valeurs à 0                         |
| Fin J3 | Lot 2 (avec l'adaptateur RabbitMQ du Lot 4) | Les 3 services (livrés dans le squelette) tournent ensemble dans `infra/poc/compose.yml`                       |
| Fin J4 | Lots 2, 3, 4                                | Premier lancement officiel du banc dans `results/`                                                             |
| Fin J5 | Tous                                        | Deuxième lancement officiel, vidéos de démo, gel du code, répétition                                           |
| J6     | Tous                                        | Soutenance                                                                                                     |

## 10. Pour la soutenance (rappel de la répartition)

| Lot  | Partie de la présentation                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------- |
| 1    | Schéma logique et schéma d'architecture physique (sans nommer de technologie)                        |
| 2    | Cycle de vie DevSecOps, types de tests et leur place dans le pipeline, comparatif CI/CD              |
| 3    | Politique de sécurité, comparatif SSO                                                                |
| 4    | Schéma de l'orchestrateur Kubernetes, attributs qualité, métiers et interactions, comparatif Brokers |
| Tous | Organisation du groupe (début), bilan et axes d'amélioration (fin), PPT                              |
