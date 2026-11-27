# Lot 2 — CI/CD : GitHub Actions vs TeamCity, et service Troc

**Responsable : ____________**
À lire avant ce fichier : [`docs/socle-commun.md`](../socle-commun.md) et [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

---

## Ta mission en une phrase

Le même pipeline DevSecOps tourne dans GitHub Actions et dans TeamCity, sur le même dépôt. Ton banc de test mesure les deux et les piège (test cassé, faille, secret, panne d'agent) pour montrer comment chacun réagit.

## Pourquoi c'est important

La comparaison CI/CD est **obligatoire** dans la grille (3 points). Ton pipeline est aussi celui de toute l'équipe : c'est lui qui bloque une PR cassée. Tu couvres en prime les parties « cycle DevSecOps » et « tests dans le pipeline » de la soutenance (4 points). Enfin, tu possèdes le service **Troc** et le compose du POC, qui fait tourner les 3 services ensemble.

---

## Déjà en place dans le squelette

- **Service Troc** complet pour démarrer : les 4 routes, la validation, la publication de `offer.created`, le choix « 503 si la publication échoue », les deux stockages (mémoire et PostgreSQL, choisis par `STORE`), les tests, le Dockerfile, le README. Il est dans ta partie : fais-le évoluer, garde les tests verts.
- **La CI démarre déjà un PostgreSQL** (service `postgres` du job `qualite`) pour les tests des stockages. Garde-le en ajoutant tes étapes.
- **`.github/workflows/ci.yml`** : un job `qualite` avec 3 des 10 étapes (`installation`, `lint`, `tests_unitaires`). Ajoute les 7 autres **dans ce même job**, et **ne renomme jamais le job `qualite`** : la protection de `main` l'exige pour toute fusion.
- `infra/poc/`, `infra/cicd/`, `bench/cicd/`, `.teamcity/` : vides, à toi de jouer.

## Ta partie du dépôt

| Dossier / fichier                  | Rôle                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`         | Pipeline GitHub Actions                                                    |
| `.github/pull_request_template.md` | Règles de PR (contenu dans `CONTRIBUTING.md`)                              |
| `.teamcity/settings.kts`           | Pipeline TeamCity en Kotlin DSL                                            |
| `infra/cicd/compose.yml`           | Serveur et agent TeamCity                                                  |
| `infra/poc/compose.yml`            | Les 3 services du POC + un broker, pour les tests d'intégration et la démo |
| `bench/cicd/`                      | Le banc de test                                                            |
| `services/troc/`                   | Le service Troc                                                            |
| `fixtures/cicd.json`               | Ta liste de mesures et scénarios                                           |
| Branches `demo/*`                  | Les scénarios piégés                                                       |

---

## Ce que tu livres

- [ ] **J1 — Découverte.** Créer le projet SonarQube Cloud lié au dépôt. Lire la doc TeamCity Docker. Écrire la liste des étapes du pipeline (ci-dessous) dans `bench/cicd/README.md`.
- [ ] **J2 — Pipeline GitHub Actions** complet sur `main` et sur les PR. **C'est lui qui protège `main` pour toute l'équipe : priorité du jour.**
- [ ] **J2 — Fixture** `fixtures/cicd.json`.
- [x] **J2-J3 — Service Troc**, testé, avec son Dockerfile. _Livré dans le squelette : à toi de le faire évoluer._
- [ ] **J3 — TeamCity** installé et le même pipeline qui tourne.
- [ ] **J3 — `infra/poc/compose.yml`** qui démarre les 3 services.
- [ ] **J4 — Branches piégées** et **banc `bench/cicd`**, premier lancement officiel.
- [ ] **J5 — Tableau forces / faiblesses / limites**, second lancement officiel, vidéo de démo.
- [ ] **Soutenance.** Schéma du cycle DevSecOps ; types de tests et leur place dans le pipeline.

---

## Ce que tu attends des autres, ce qu'ils attendent de toi

| Sens                        | Quoi                                                                      | Quand  |
| --------------------------- | ------------------------------------------------------------------------- | ------ |
| Tu attends du Lot 4         | `services/shared/messaging` avec l'adaptateur `memory` (Troc publie avec) | Fin J2 |
| Tu attends du Lot 3         | `services/shared/auth` avec le mode `none` (Troc protège `POST /offers`)  | Fin J2 |
| Tu attends du Lot 1         | `results/schema.json` et la boîte à outils `@maison-epouvante/bench-kit`  | Fin J1 |
| Tout le monde attend de toi | La CI verte obligatoire sur les PR                                        | Fin J2 |
| Tout le monde attend de toi | `infra/poc/compose.yml`                                                   | Fin J3 |

En attendant le messaging et l'auth, écris des fonctions bouchons dans ton service (`publish = async () => {}`, un middleware qui laisse tout passer) et remplace-les dès la livraison.

---

## Partie A — Le pipeline

### Les étapes, identiques et dans le même ordre dans les deux outils

Leurs noms servent d'identifiants au banc : **ne les change pas**.

| #   | Étape                  | Ce qu'elle fait                                                                      | Bloque si…                           |
| --- | ---------------------- | ------------------------------------------------------------------------------------ | ------------------------------------ |
| 1   | `installation`         | `npm ci`                                                                             | échec d'installation                 |
| 2   | `lint`                 | `npm run lint`                                                                       | une erreur ESLint                    |
| 3   | `tests_unitaires`      | `npm test` (Vitest, tous les workspaces)                                             | un test échoue                       |
| 4   | `analyse_code`         | SonarQube Cloud, en attendant le verdict (`sonar.qualitygate.wait=true`)             | la qualité exigée n'est pas atteinte |
| 5   | `secrets`              | Gitleaks sur tout l'historique                                                       | un secret est trouvé                 |
| 6   | `build_images`         | `docker build` des 3 services                                                        | échec de build                       |
| 7   | `scan_images`          | Trivy sur chaque image, `--severity CRITICAL --exit-code 1`                          | une faille critique                  |
| 8   | `tests_integration`    | `docker compose -f infra/poc/compose.yml up -d`, puis appels HTTP réels, puis `down` | un appel échoue                      |
| 9   | `validation_resultats` | `npm run validate:results`                                                           | un JSON de résultats invalide        |
| 10  | `publication`          | Push des images sur GitHub Container Registry, **sur `main` uniquement**             | échec de push                        |

### Le principe qui rend la comparaison honnête

**Les mêmes outils, aux mêmes versions, lancés de la même façon dans les deux pipelines** : Gitleaks, Trivy et le scanner Sonar en **images Docker à version épinglée** (`zricethezav/gitleaks:<version>`, `aquasec/trivy:<version>`, `sonarsource/sonar-scanner-cli:<version>`). Ce qu'on compare, c'est l'orchestrateur de pipeline, pas les outils de scan.

Bonus : l'image Docker évite aussi de dépendre de l'action GitHub officielle de Gitleaks et de ses conditions de licence.

### GitHub Actions — conseils

- Déclencheurs : `push`, `pull_request` **et `workflow_dispatch`** (indispensable : c'est comme ça que ton banc le lancera).
- Un seul job séquentiel avec des `steps` portant exactement les noms du tableau (`name: tests_unitaires`). Le banc lit les durées étape par étape.
- `actions/setup-node` avec `node-version-file: .nvmrc` et `cache: npm`.
- Secrets : `SONAR_TOKEN` dans les secrets du dépôt. La publication utilise le `GITHUB_TOKEN` fourni, avec `permissions: packages: write`.
- Tags d'images : `ghcr.io/simonbrs04/maison-epouvante-<service>:gha-<sha>` (le registre exige des minuscules).

### TeamCity — conseils

- `infra/cicd/compose.yml` : `jetbrains/teamcity-server` (port 8111, données dans `infra/cicd/data/`, ignoré par git) et **un** `jetbrains/teamcity-agent`. Donne à l'agent l'accès au Docker de l'hôte, en montant le socket ou en suivant la doc JetBrains « Docker-in-Docker ». Il doit pouvoir faire `docker build` et `docker compose`.
- Premier démarrage : assistant d'installation (base interne : suffisant pour le POC, limite à citer), puis autoriser l'agent.
- Racine VCS : le dépôt GitHub, avec un jeton GitHub en lecture seule. Branches surveillées : `+:refs/heads/*`.
- **Kotlin DSL sans douleur** : construis d'abord le pipeline dans l'interface, étape par étape, avec les mêmes noms. Puis télécharge la configuration au format Kotlin (Project Settings → Actions → _Download settings in Kotlin format_) et commite-la par une PR. Ne laisse pas TeamCity pousser seul sur `main` : la protection de branche le bloquerait.
- Secrets en paramètres de type _password_ (`env.SONAR_TOKEN`…), jamais en clair dans le `.kts`.
- Tags d'images : `…:tc-<sha>`, pour ne pas écraser ceux de GitHub.
- TeamCity tourne en local et GitHub ne peut pas le prévenir d'un push : il interroge le dépôt à intervalles réguliers. Pour la mesure, ton banc déclenche les deux outils par API : ce délai ne fausse donc pas la comparaison. Cite-le quand même comme différence.

---

## Partie B — Le service Troc

L'espace où un membre propose un goodie à échanger ou à donner.

| Route             | Accès         | Comportement                                       |
| ----------------- | ------------- | -------------------------------------------------- |
| `GET /health`     | public        | voir socle                                         |
| `GET /offers`     | public        | liste, filtre facultatif `?categorie=`             |
| `GET /offers/:id` | public        | une offre, `404` sinon                             |
| `POST /offers`    | rôle `membre` | crée l'offre, publie `offer.created`, répond `201` |

Corps de `POST /offers` : `titre` (3 à 80 caractères), `description` (500 maximum), `type` (`echange` ou `don`), `categorie` (`figurines`, `blu-ray`, `bd`, `jeux`, `goodies`, `fanzine`). Le `membreId` vient du jeton (`req.user.id`, fourni par le middleware du Lot 3), jamais du corps.

- Valide le corps à la main ou avec `zod`. Un champ invalide → `400` au format d'erreur du socle.
- Publie l'événement au format du socle avec `createPublisher()` du Lot 4 ; la clé de message est le `membreId`.
- Choix à documenter dans ton README : si la publication échoue, l'offre est-elle quand même créée ? (Proposition : non, réponse `503`, pour ne jamais avoir d'offre sans notification.)
- Données en mémoire, quelques offres de départ dans `data/offers.json`.

### `infra/poc/compose.yml`

- Les 3 services, construits depuis leurs Dockerfile, sur leurs ports du socle.
- `name: maison-epouvante` en tête du fichier, comme tous les compose du projet : ils partagent ainsi un seul PostgreSQL.
- PostgreSQL : **inclus**, pas recopié (`include: [../postgres/compose.yml]`). Chaque service reçoit `STORE=postgres` et son URL, avec `postgres` comme hôte dans le réseau Docker (`postgres://maison:maison_dev@postgres:5432/troc`…), et `depends_on: postgres: condition: service_healthy`.
- Un RabbitMQ pour que les services se parlent vraiment (`BROKER=rabbitmq`). L'adaptateur `memory` ne traverse pas les conteneurs.
- `SSO=none` et `NODE_ENV=test` pour les tests d'intégration. Les vrais fournisseurs SSO restent dans le banc du Lot 3.
- `healthcheck` sur chaque service, et `depends_on` avec `condition: service_healthy`.
- Test d'intégration de bout en bout : `POST /offers` sur Troc → la notification apparaît sur `GET /notifications` (réessayer pendant 5 s maximum).

---

## Partie C — Le banc `bench/cicd`

### Protocole

- **Déclencher** : GitHub via `POST /repos/{owner}/{repo}/actions/workflows/ci.yml/dispatches` avec `ref` = la branche ; TeamCity via `POST /app/rest/buildQueue` avec `branchName`.
- **Retrouver le lancement GitHub** : l'appel de déclenchement ne renvoie pas d'identifiant. Note l'heure avant l'appel, puis cherche dans `GET …/actions/runs?branch=<branche>&event=workflow_dispatch` le premier lancement créé après cette heure.
- **Attendre** : interroger toutes les 10 s jusqu'à la fin (délai maximum 45 min).
- **Lire les durées** : GitHub via `GET …/actions/runs/{id}/jobs` (début et fin de chaque `step`) ; TeamCity via `GET /app/rest/builds/id:{id}` et ses statistiques de build.
- **À froid** : vider les caches avant. GitHub via `DELETE …/actions/caches` ; TeamCity via un _clean checkout_ et `docker builder prune -af` sur l'agent.
- Répétitions : 1 à froid + 3 avec cache.
- `--collecte-seule` : ne déclenche rien, relit les derniers lancements de `main` et des `demo/*`. C'est le mode du bouton du dashboard le jour J.
- Bibliothèques conseillées : `@octokit/rest` pour GitHub, `fetch` natif pour TeamCity (`Authorization: Bearer <TEAMCITY_TOKEN>`, `Accept: application/json`).
- Options, progression, statistiques et écriture du résultat : utilise `@maison-epouvante/bench-kit` (Lot 1). `writeResult()` valide le JSON et l'écrit proprement, ne le refais pas à la main.

### Mesures

| id                                         | Libellé                              | Catégorie       | Unité  | Meilleur | Comment                                              |
| ------------------------------------------ | ------------------------------------ | --------------- | ------ | -------- | ---------------------------------------------------- |
| `duree_froid`                              | Pipeline complet, à froid            | Performance     | s      | bas      | 1er lancement après vidage des caches                |
| `duree_cache`                              | Pipeline complet, avec cache         | Performance     | s      | bas      | Médiane de 3 lancements                              |
| `attente_file`                             | Attente avant démarrage              | Performance     | s      | bas      | Du déclenchement au début de la 1re étape            |
| `etape_installation` … `etape_publication` | Une mesure par étape                 | Durée par étape | s      | bas      | Début et fin de l'étape, avec cache                  |
| `retour_erreur`                            | Délai avant signalement d'une erreur | Fiabilité       | s      | bas      | Déclenchement de `demo/test-casse` → statut en échec |
| `taille_config`                            | Taille de la configuration           | Exploitation    | lignes | bas      | Lignes de `ci.yml` et de `settings.kts`              |

### Scénarios (une branche `demo/*` chacun, créée depuis `main`, jamais fusionnée)

| id                      | Branche           | Ce qu'on provoque                                                    | Sain attendu                     | Ce qu'on relève                             |
| ----------------------- | ----------------- | -------------------------------------------------------------------- | -------------------------------- | ------------------------------------------- |
| `test_casse`            | `demo/test-casse` | Un test unitaire qui échoue                                          | Arrêt à `tests_unitaires`        | Étape d'arrêt, délai, lisibilité du rapport |
| `dependance_vulnerable` | `demo/dependance` | Une ancienne version d'un paquet npm avec une faille critique connue | Pipeline bloqué                  | Étape qui bloque, faille citée              |
| `image_vulnerable`      | `demo/image`      | Une image Docker de base ancienne                                    | Blocage à `scan_images`          | Nombre de failles critiques                 |
| `secret_commite`        | `demo/secret`     | Une fausse clé d'API au bon format                                   | Blocage à `secrets`              | Détecté ou non, fichier et ligne cités      |
| `secret_dans_logs`      | `demo/logs`       | Une étape affiche volontairement un secret                           | Valeur masquée                   | Masquée ou en clair                         |
| `builds_concurrents`    | `main` ×3         | 3 lancements déclenchés en même temps                                | Les 3 démarrent sans attendre    | Attente du 3e (TeamCity a 1 agent)          |
| `panne_executeur`       | `main`            | `docker stop` de l'agent TeamCity en plein build                     | Build en échec propre ou relancé | État final. GitHub : `NA`                   |

**Choisir la dépendance vulnérable** : teste avec `docker run aquasec/trivy fs .` sur la branche jusqu'à obtenir au moins une faille `CRITICAL`. Note la version et le numéro de la faille dans le README du banc.

---

## Pièges connus

- **GitHub peut refuser ton faux secret.** Sur un dépôt public, la protection de push de GitHub bloque certains formats de clés connus avant même le pipeline. Si ça arrive, c'est un constat intéressant (GitHub protège en amont, TeamCity non). Note-le, puis utilise un format de clé que Gitleaks détecte mais que GitHub ne bloque pas, pour tester quand même le pipeline.
- **Agent TeamCity sans Docker** : si `docker build` échoue dans l'agent, c'est presque toujours l'accès au Docker de l'hôte qui manque.
- **Chemins et fins de ligne** : `.gitattributes` force LF partout sauf `*.bat` (CRLF). Ne le contourne pas.
- **Quotas** : minutes GitHub illimitées sur un dépôt public ; TeamCity gratuit limité à 3 agents et 100 configurations de build.
- **Ne mesure pas pendant que quelqu'un pousse** : un push de l'équipe déclenche des pipelines qui faussent `attente_file`. Préviens avant un lancement officiel.

---

## Pour la soutenance

- **Cycle de vie DevSecOps** (schéma fait maison) : planifier, coder, construire, tester, publier, déployer, exploiter, superviser, en boucle. La sécurité apparaît à chaque phase : modélisation des menaces au départ, analyse de code et secrets au commit, scan des dépendances et des images au build, tests de sécurité avant la mise en production, supervision et gestion des incidents en production. Explique chaque phase en une phrase.
- **Types de tests et leur place dans le pipeline** : unitaires, analyse statique, secrets, dépendances et images, intégration, bout en bout, charge et performance, sécurité dynamique, tests d'accessibilité (RGAA, exigé par le client). Pour chacun : à quelle étape, sur quel événement (chaque commit, chaque PR, avant la mise en production, chaque nuit), quel attribut qualité il vérifie. La consigne ne demande pas de nommer les outils.
- **Démonstration** : le dashboard (onglet CI/CD) + 1 ou 2 scénarios piégés montrés en vidéo.

---

## Terminé quand

- [ ] Une PR qui casse un test est bloquée par GitHub Actions.
- [ ] Le même commit passe dans les deux outils avec les 10 étapes aux mêmes noms.
- [ ] `docker compose -f infra/poc/compose.yml up` démarre les 3 services, et le test de bout en bout passe.
- [ ] Les 7 scénarios ont un statut pour les deux outils.
- [ ] 2 lancements officiels dans `results/cicd/`, plus le README du banc.

---

## Prompt de départ pour ton IA

> Je travaille sur un projet étudiant (monorepo Node.js 24, modules ES, Express, Vitest, Docker). Je te joins `docs/socle-commun.md` (conventions et contrat de données, qui font foi) et `docs/lots/lot-2-cicd.md` (ma mission). Respecte strictement le socle et `CONTRIBUTING.md`. Commence par `.github/workflows/ci.yml` avec les 10 étapes nommées exactement comme dans mon fichier, Gitleaks, Trivy et le scanner Sonar lancés en images Docker à version épinglée. Code propre ; code, commentaires et noms de tests en anglais (voir CONTRIBUTING.md, « Code et langue »).
