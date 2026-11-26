# Contribuer — règles GitHub de l'équipe

> Ces règles sont les mêmes pour les 4. Elles sont courtes exprès : respecte-les à la lettre et personne n'aura de mauvaise surprise.
> Le socle technique (stack, ports, contrat de résultats) est dans [`docs/socle-commun.md`](docs/socle-commun.md).

---

## 1. Le dépôt

| Élément            | Règle                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hébergement        | Le compte GitHub de Simon. Les 3 autres sont **collaborateurs** : tout le monde a accès à tout le dépôt                                                        |
| Dépôt              | Un seul dépôt, `maison-epouvante`, **public**. Public = minutes GitHub Actions gratuites, SonarQube Cloud gratuit. Conséquence : **aucun vrai secret, jamais** |
| Branche principale | `main`, protégée (voir §6)                                                                                                                                     |
| Suivi des tâches   | Trello. GitHub Issues seulement pour signaler un bug à un autre lot                                                                                            |

---

## 2. Avant de commencer, une seule fois

```bash
git clone https://github.com/SimonBRS04/maison-epouvante.git
cd maison-epouvante
nvm use            # Node 22, lu dans .nvmrc (sous Windows : nvm-windows ou installer Node 22)
npm ci             # installe tout le monorepo
cp .env.example .env
npm run lint       # doit passer
npm test           # doit passer
```

Configure ton identité git avec l'adresse de ton compte GitHub :

```bash
git config user.name "Prénom Nom"
git config user.email "adresse@du-compte-github"
```

---

## 3. Le cycle de travail, chaque jour

1. **Le matin** : `git switch main && git pull`.
2. **Une branche par tâche** (une carte Trello = une branche) : `git switch -c lot3/feat-middleware-auth`.
3. **Commits petits et fréquents**, au format décrit au §4.
4. **Pousse au moins une fois par jour**, même si ce n'est pas fini (ouvre la pull request en brouillon).
5. **Pull request** vers `main` quand c'est prêt, relue par une autre personne.
6. **Fusion** en « Squash and merge » une fois la relecture approuvée et la CI verte.
7. Si `main` a bougé pendant ton travail : `git fetch && git rebase origin/main`, puis `git push --force-with-lease` **sur ta branche uniquement**.

---

## 4. Nommage

### Branches

```
<lot>/<type>-<sujet-court>
```

| Exemple                     | Sens                                                                           |
| --------------------------- | ------------------------------------------------------------------------------ |
| `lot1/feat-onglet-sso`      | Lot 1, nouvelle fonctionnalité                                                 |
| `lot2/fix-cache-teamcity`   | Lot 2, correction                                                              |
| `lot3/doc-readme-banc`      | Lot 3, documentation                                                           |
| `lot4/config-compose-kafka` | Lot 4, configuration                                                           |
| `demo/test-casse`           | **Réservé au Lot 2** : branches piégées des scénarios CI/CD, jamais fusionnées |

### Les 4 types (branches et commits)

| Type     | Quand l'utiliser                                                                         |
| -------- | ---------------------------------------------------------------------------------------- |
| `feat`   | Nouvelle fonctionnalité ou évolution du code, avec ses tests                             |
| `fix`    | Correction d'un bug ou d'un test cassé                                                   |
| `doc`    | Documentation : README, `docs/`, schémas, commentaires                                   |
| `config` | Configuration : CI/CD, Docker, compose, dépendances, outils (lint…), résultats officiels |

Aucun autre type n'est accepté.

### Commits

```
<type>(<portée>): <description en français, à l'infinitif, sans majuscule ni point final>
```

Portées autorisées : `dashboard`, `bench-kit`, `cicd`, `sso`, `brokers`, `catalogue`, `troc`, `notifications`, `auth`, `messaging`, `infra`, `results`, `docs`, `repo`.

```
feat(messaging): ajouter l'adaptateur RabbitMQ
fix(dashboard): corriger le tri de l'historique
doc(sso): décrire la configuration Auth0 pas à pas
config(cicd): ajouter le scan Trivy dans GitHub Actions
config(results): ajouter le lancement officiel brokers du 2026-12-03
```

### Code

- Variables, fonctions, fichiers : **en anglais**, `camelCase` pour les variables et fonctions, `kebab-case` pour les fichiers.
- Commentaires, README, messages de commit, pull requests : **en français**.
- Identifiants du contrat de résultats (`id` de mesures et scénarios) : `snake_case`, sans accent.

---

## 5. Pull requests

- **Titre** = le message de commit final (format §4), puisqu'on fusionne en squash.
- **Taille** : vise moins de 400 lignes modifiées. Plus gros → découpe.
- **Description** : remplis le modèle (`.github/pull_request_template.md`) :

```markdown
## Quoi

Ce que la PR change, en 2-3 lignes.

## Pourquoi

La carte Trello ou le besoin.

## Comment tester

Les commandes exactes pour vérifier.

## Checklist

- [ ] `npm run lint` passe
- [ ] `npm test` passe
- [ ] Fixture mise à jour si j'ai ajouté une mesure ou un scénario
- [ ] README de mon banc ou de mon service à jour
- [ ] Aucun secret dans le code ni dans l'historique
```

- **Relecture** : au moins 1 approbation d'une autre personne. Si tu touches au dossier d'un autre lot, préviens son responsable et demande-lui de relire : on attend son accord avant de fusionner.
- **Délai** : on relit les PR des autres dans la demi-journée. Une PR qui attend bloque quelqu'un.
- **Relire, c'est** : lancer le « Comment tester », vérifier le respect du socle, poser des questions. Pas réécrire le travail de l'autre.

---

## 6. Protection de `main` (réglée à la création du dépôt)

- Pas de push direct, pas de force push, pas de suppression.
- Pull request obligatoire, 1 approbation d'une autre personne, discussions résolues.
- CI verte obligatoire avant fusion : le contrôle `qualite` (job GitHub Actions). **Ne jamais renommer ce job**, sinon plus aucune PR ne peut fusionner.
- Branche à jour avec `main` obligatoire.
- Fusion autorisée : **squash uniquement**.
- Les branches sont supprimées automatiquement après fusion, sauf `demo/*`.

TeamCity tourne aussi sur chaque push, mais ne bloque pas la fusion : c'est l'objet de la comparaison, pas le gardien.

---

## 7. Chacun sa partie, tout le monde partout

- **Tout le monde a accès à tout** le dépôt. Il n'y a aucune restriction technique par lot.
- Chacun travaille **dans sa partie** (voir le tableau « Qui s'occupe de quoi » du socle commun). C'est une règle d'équipe, pas un verrou.
- Besoin de toucher à la partie d'un autre ? Fais-le, mais **préviens son responsable** et mets-le en relecteur de ta PR.
- Les fichiers communs (`docs/socle-commun.md`, `CONTRIBUTING.md`, `package.json`, `eslint.config.js`) se modifient après accord de toute l'équipe.

---

## 8. Secrets

Le dépôt est public : **un secret poussé une seule fois est compromis**, même supprimé ensuite (il reste dans l'historique).

- Jamais de mot de passe, jeton ou clé dans le code. Ils vont dans `.env` (ignoré par git).
- `.env.example` liste toutes les variables, avec des valeurs vides ou factices.
- Pour la CI : secrets GitHub Actions (`Settings → Secrets and variables → Actions`) et paramètres de type « password » dans TeamCity.
- Secrets attendus : `SONAR_TOKEN`, `TEAMCITY_TOKEN`, `GH_BENCH_TOKEN`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`.
- Un secret poussé par erreur : préviens l'équipe tout de suite, **révoque-le chez le fournisseur**, puis on nettoie.
- Exception encadrée : la fausse clé du scénario `demo/secret` (Lot 2), au bon format mais sans aucune valeur.

---

## 9. Étiquettes (issues et PR)

| Étiquette         | Usage                                                  |
| ----------------- | ------------------------------------------------------ |
| `lot-1` … `lot-4` | Lot concerné                                           |
| `contrat`         | Touche au format des résultats ou au socle commun      |
| `bloquant`        | Empêche un autre lot d'avancer : à traiter en priorité |
| `bug`             | Comportement incorrect                                 |
| `soutenance`      | Schémas, PPT, démo                                     |

---

## 10. Versions repères

| Étiquette git | Quand  | Contenu                                        |
| ------------- | ------ | ---------------------------------------------- |
| `v0.1.0`      | Fin J2 | Socle, interfaces partagées, fixtures          |
| `v0.2.0`      | Fin J4 | Les 3 bancs produisent des résultats officiels |
| `v1.0.0`      | Fin J5 | Gel pour la soutenance                         |

---

## 11. En cas de doute

1. Relis `docs/socle-commun.md`.
2. Demande sur le canal de l'équipe **avant** de contourner une règle.
3. Une règle gêne vraiment ? Propose une modification de ce fichier par pull request : on en discute, on décide ensemble.
