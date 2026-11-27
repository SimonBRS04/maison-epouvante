# Lot 1 — Dashboard et contrat de résultats

**Responsable : Simon**
À lire avant ce fichier : [`docs/socle-commun.md`](../socle-commun.md) et [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

---

## Ta mission en une phrase

Le jour de la soutenance, un double-clic ouvre un dashboard qui montre, pour chacun des 3 comparatifs, les deux technos côte à côte : mesures, scénarios de panne, historique. Un bouton relance le banc en direct.

## Pourquoi c'est important

Le dashboard **est la démonstration**. Les 6 points de démo de la grille se jouent devant lui. Tu es aussi le **gardien du contrat** : si le format des résultats est clair et stable, les 3 autres lots travaillent sans jamais t'attendre, et toi sans jamais les attendre. Enfin, ta **boîte à outils des bancs** garantit que les 3 bancs mesurent, comptent et écrivent leurs résultats exactement de la même façon.

---

## Déjà en place dans le squelette

- Le monorepo : workspaces npm, ESLint + Prettier (`npm run lint` vérifie les deux), `.gitignore` (dont `.env`), `.gitattributes`, `.env.example`, la CI minimale, les règles GitHub.
- Les 3 services et les modules partagés en version de départ, avec leurs deux stockages (mémoire et PostgreSQL).
- `dashboard/`, `packages/`, `results/`, `fixtures/` : vides, à toi de jouer. Tes workspaces (`dashboard`, `packages/bench-kit`) sont déjà déclarés dans le `package.json` racine : il suffit de leur créer un `package.json`.

## Ta partie du dépôt

| Dossier / fichier             | Rôle                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `results/schema.json`         | Le contrat v1, en JSON Schema                                                                                   |
| `packages/bench-kit/`         | `@maison-epouvante/bench-kit` : les fonctions communes aux 3 bancs (voir socle, §7)                             |
| `scripts/validate-results.js` | `npm run validate:results` : vérifie `results/`, `results-dev/` et `fixtures/`                                  |
| `dashboard/`                  | Serveur Express + page web                                                                                      |
| `services/shared/db/`         | `@maison-epouvante/db` : accès PostgreSQL commun aux 3 services (connexion, transactions, santé, bases de test) |
| `infra/postgres/`             | Le PostgreSQL partagé (une base par service + une pour Keycloak), inclus par les autres compose                 |
| `lancer.bat`, `lancer.sh`     | Le double-clic du jour J                                                                                        |
| `docs/schemas/`               | Tes schémas de la soutenance                                                                                    |

---

## Ce que tu livres

- [x] **J1 — Contrat.** `results/schema.json` (draft 2020-12) qui traduit exactement la section 8 du socle, et `npm run validate:results`. Présente-le à l'équipe en fin de journée : une fois validé, il est figé.
- [x] **J1 — Boîte à outils `bench-kit`.** Les 6 fonctions du socle (§7), testées. Les 3 autres lots s'en servent dès le J2 : c'est ta priorité avec le schéma.
- [ ] **J2 — Serveur.** `dashboard/server.js` et son API (voir plus bas), qui lit déjà les fixtures.
- [ ] **J3 — Page, partie mesures.** Onglets, en-tête, tableau des mesures, graphiques.
- [ ] **J4 — Page, partie scénarios et historique.** Grille des scénarios, courbe d'historique, comparaison au lancement précédent, bouton « Lancer » avec suivi en direct.
- [ ] **J5 — Finitions.** `lancer.bat` / `lancer.sh`, tests sur les vrais résultats, tests sur le PC de démo, nettoyage visuel.
- [ ] **Soutenance.** Schéma logique et schéma d'architecture physique de l'application complète.

---

## Ce que tu attends des autres

| De qui       | Quoi                                                                                                                 | Quand  |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ------ |
| Lots 2, 3, 4 | `fixtures/<comparatif>.json` : leur vraie liste de mesures et scénarios, valeurs à 0                                 | Fin J2 |
| Lots 2, 3, 4 | Un script `bench:<comparatif>` qui respecte le protocole d'exécution (lignes `ETAPE=`, `RESULTAT=`, codes de sortie) | Fin J4 |
| Lots 2, 3, 4 | Au moins 2 lancements officiels dans `results/<comparatif>/`                                                         | Fin J5 |

Tant que les fixtures n'existent pas, crée-en une toi-même pour `brokers` à partir de l'exemple du socle, et remplace-la dès que le Lot 4 livre la sienne.

---

## Conseils d'implémentation

### 1. Le schéma JSON (J1)

- Utilise `ajv` (version 8, `import Ajv2020 from 'ajv/dist/2020.js'`) et `ajv-formats` pour valider `date` en `date-time`.
- Mets `additionalProperties: false` partout : un champ mal orthographié doit être refusé, pas ignoré.
- Utilise des `enum` pour `comparatif`, `categorie`, `unite`, `meilleur`, `statut`, `technos[].id`.
- `valeurs` et `resultats` sont des objets dont les clés sont des `id` de technos : `propertyNames` avec l'enum des technos.
- `valeurs.<techno>` : `oneOf` entre `{ mediane, min, max }` (nombres) et `null`.
- Place la validation dans `bench-kit` (`validateResult(json)` → `{ valid, errors }`). `writeResult()` et `scripts/validate-results.js` l'utilisent tous les deux : une seule source de vérité.
- Écris un test Vitest par règle importante : un JSON valide passe, un statut inconnu est refusé, une techno inconnue est refusée…

### 2. La boîte à outils `bench-kit` (J1)

```
packages/bench-kit/
├─ package.json        "name": "@maison-epouvante/bench-kit"
├─ src/
│  ├─ index.js         réexporte tout
│  ├─ args.js          parseArgs()
│  ├─ progress.js      step()
│  ├─ stats.js         median(), percentile(), measure()
│  ├─ environment.js   environment()
│  ├─ validate.js      validateResult() (charge results/schema.json)
│  └─ write.js         writeResult()
└─ test/
```

- `percentile` : méthode du rang le plus proche, documentée dans le code. Les 3 bancs calculent ainsi leurs p95 de la même manière.
- `measure(fn, { repetitions = 5, warmup = 1 })` : appelle `fn` (qui renvoie un nombre), ignore les tours d'échauffement, renvoie `{ mediane, min, max }`. En `--rapide` : 1 répétition, sans échauffement.
- `environment()` : `os.hostname()`, `os.type()` et `os.release()`, `os.cpus()[0].model`, `os.totalmem()` en Go, et le commit court via `git rev-parse --short HEAD`.
- `writeResult(json, { official })` : nom de fichier tiré de `json.date` (deux-points remplacés par des tirets, sinon Windows refuse), écriture dans `.tmp` puis `fs.rename`, dossier `results/` ou `results-dev/`. Si invalide → `rejets/`, erreurs affichées, `process.exitCode = 2`. Dernière ligne affichée : `RESULTAT=<chemin>`.

### 3. Le serveur (J2)

```
dashboard/
├─ server.js
├─ src/
│  ├─ results-repository.js   lit les dossiers results/, results-dev/, fixtures/
│  ├─ bench-runner.js         lance un banc, diffuse sa progression
│  └─ routes.js
├─ public/                    la page (servie en statique)
└─ test/
```

| Route                                                        | Réponse                                                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/comparatifs`                                       | `["cicd", "sso", "brokers"]`                                                                                                               |
| `GET /api/results/:comparatif?source=officiel\|dev\|fixture` | Tableau des lancements, **du plus récent au plus ancien**. Ignore le sous-dossier `rejets/` et les fichiers `.tmp`                         |
| `POST /api/run/:comparatif`                                  | Lance `npm run bench:<comparatif> -- --officiel`. `409` si un banc tourne déjà. Pour `cicd`, ajoute `--collecte-seule`                     |
| `GET /api/run/:comparatif/events`                            | Flux Server-Sent Events : une ligne `ETAPE=` = un événement, puis un événement final `fin` avec le code de sortie et le chemin du résultat |

- **Sécurité** (on est dans un projet DevSecOps) : vérifie `:comparatif` contre la liste `cicd|sso|brokers` avant toute lecture de fichier ou tout lancement. Sinon, n'importe qui peut lire ou lancer ce qu'il veut sur la machine.
- Lancement sous Windows : `spawn('npm', [...], { shell: true })`, sinon `npm.cmd` n'est pas trouvé.
- Lis la sortie du banc ligne par ligne (`readline` sur `child.stdout`) et ne garde que les lignes `ETAPE=` et `RESULTAT=`.
- En-tête `Cache-Control: no-store` sur l'API : on veut toujours les derniers fichiers.

### 4. La page (J3-J4)

Structure conseillée, en modules ES sans outil de build :

```
public/
├─ index.html
├─ styles.css
└─ js/
   ├─ main.js            onglets, chargement
   ├─ api.js             appels au serveur
   ├─ format.js          nombres, dates, unités (fonctions pures, testées)
   ├─ compare.js         gagnant, écart avec le lancement précédent (fonctions pures, testées)
   ├─ render-header.js
   ├─ render-mesures.js
   ├─ render-scenarios.js
   └─ render-historique.js
```

**Un onglet par comparatif**, dans cet ordre de haut en bas :

1. **En-tête** : date du lancement, machine, versions des deux technos, sélecteur « comparer avec » (lancement précédent par défaut).
2. **Mesures**, regroupées par `categorie`. Une ligne par mesure : libellé · techno A · techno B · écart avec le lancement précédent. La meilleure valeur (selon `meilleur`, sur la médiane) est mise en avant. Min et max dans une infobulle.
3. **Graphiques** : un graphique en barres groupées par couple (catégorie, unité). Attention : deux mesures d'une même catégorie peuvent avoir des unités différentes (ms et msg/s), ne les mets jamais sur le même axe.
4. **Scénarios** : une grille, une ligne par scénario, une colonne par techno. Dans chaque case, le statut (texte + couleur), le constat, la valeur. `OK` vert, `PARTIEL` orange, `KO` rouge, `NA` gris.
5. **Historique** : courbe d'une mesure choisie dans une liste, une série par techno, l'axe des x étant la date du lancement.
6. **Bouton « Lancer »** en haut à droite de l'onglet. Pendant l'exécution : bouton désactivé, dernière `ETAPE` affichée. À la fin : rechargement automatique de l'onglet.

**Règles de rendu, à suivre partout :**

- L'ordre des colonnes de technos = l'ordre du tableau `technos`.
- Nombres alignés à droite, formatés avec `Intl.NumberFormat('fr-FR')`, l'unité dans l'en-tête de colonne plutôt que dans chaque cellule.
- Une valeur `null` affiche « — », avec la `note` de la mesure en infobulle.
- Le statut n'est jamais indiqué par la couleur seule : le mot `OK`/`KO` est toujours écrit (accessibilité, RGAA).
- Si le lancement comparé vient d'une autre machine, affiche un avertissement discret : les chiffres ne sont pas comparables.
- Pas de texte explicatif superflu à l'écran : les libellés suffisent.
- Le dashboard ne connaît **aucune** mesure par son nom : tout vient du JSON. Si tu te surprends à écrire `if (mesure.id === 'latence_p95')`, c'est que le contrat doit évoluer.

**Chart.js** : installe-le avec npm et sers `node_modules/chart.js/dist/chart.umd.js` en statique. Pas de CDN : le jour J, le wifi de la salle ne doit pas pouvoir casser la démo.

### 5. Le lanceur (J5)

`lancer.bat` :

```bat
@echo off
cd /d "%~dp0"
docker compose -f infra/poc/compose.yml up -d
start "" http://localhost:3000
npm run dashboard
```

`lancer.sh` : même chose en bash (`xdg-open` ou `open`). Le dashboard doit démarrer même si un des bancs n'a encore aucun résultat (onglet vide avec « Aucun lancement officiel »).

### 6. Tes tests

Vitest sur les fonctions pures (`format.js`, `compare.js`, le dépôt de résultats avec un dossier temporaire) et Supertest sur l'API. C'est ce qui fera passer ton code dans les deux pipelines du Lot 2.

---

## Pièges connus

- **Fichier à moitié écrit** : un banc écrit `.json.tmp` puis renomme. N'affiche jamais un `.tmp`.
- **Chemins Windows** : utilise toujours `path.join`, jamais de `/` concaténés à la main.
- **Tri par date** : trie sur le champ `date` du JSON, pas sur le nom du fichier ni sur la date de modification.
- **Deux lancements en même temps** : un seul banc à la fois, sinon les mesures se faussent mutuellement.
- **Résultats dev mélangés aux officiels** : l'onglet affiche `officiel` par défaut. `dev` uniquement via un sélecteur.

---

## Pour la soutenance

- **Schéma logique** : les composants métier de la plateforme complète, et pas seulement du POC. Boutique, panier et commande, abonnement au fanzine, liseuse, troc, notifications, recommandation, modération, chat, news, espace membre, back-office.
- **Schéma d'architecture physique** : les mêmes composants regroupés en services, avec leurs bases de données, la messagerie entre services, la passerelle d'entrée, l'authentification, les systèmes existants (caisses, stock, CRM, La Poste). **Sans nommer de technologie** (consigne) : « broker de messages », pas « Kafka ».
- Fais-les toi-même (consigne : pas de schéma repris du web), dans `docs/schemas/`.

---

## Terminé quand

- [ ] `npm run validate:results` refuse un JSON invalide et accepte les fixtures des 3 lots.
- [ ] Les 3 bancs écrivent leurs résultats avec `writeResult()` de `bench-kit`.
- [ ] Double-clic sur `lancer.bat` sur le PC de démo → le dashboard s'ouvre avec les 3 onglets remplis.
- [ ] Le bouton « Lancer » relance un banc et l'onglet se met à jour tout seul.
- [ ] L'historique montre au moins 2 lancements par comparatif.
- [ ] Tests verts dans les deux pipelines.

---

## Prompt de départ pour ton IA

> Je développe le dashboard d'un projet étudiant (monorepo Node.js 24, modules ES, Express, Vitest, page web sans framework avec Chart.js). Je te joins `docs/socle-commun.md` (le contrat de données, qui fait foi) et `docs/lots/lot-1-dashboard.md` (ma mission). Respecte strictement les conventions du socle et de `CONTRIBUTING.md`. Commence par `results/schema.json` et le workspace `packages/bench-kit` (les 6 fonctions décrites dans le socle), avec leurs tests. Code propre, fonctions courtes ; code, commentaires et noms de tests en anglais (voir CONTRIBUTING.md, « Code et langue »).
