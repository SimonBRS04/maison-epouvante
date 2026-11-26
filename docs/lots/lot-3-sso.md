# Lot 3 — SSO : Keycloak vs Auth0, et service Catalogue

**Responsable : ____________**
À lire avant ce fichier : [`docs/socle-commun.md`](../socle-commun.md) et [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

---

## Ta mission en une phrase

Le POC accepte indifféremment des jetons Keycloak ou Auth0, avec le même code. Ton banc de test mesure les temps et provoque attaques et pannes (jeton falsifié, révocation, force brute, fournisseur coupé) pour montrer comment chacun réagit.

## Pourquoi c'est important

Le client a fait de la sécurité une **contrainte forte** : c'est une plateforme commerciale. Ton comparatif compte pour la démonstration « 2 technologies pour l'application » (3 points). Tu couvres aussi la **politique de sécurité** de la soutenance (2 points). Et tu fournis le middleware d'authentification que les 3 services utilisent : sans lui, personne ne protège ses routes.

---

## Déjà en place dans le squelette

- **`services/shared/auth`** : l'interface définitive (`createAuth`, `requireAuth`, `requireRole`), le mode `none` (en-têtes `X-Dev-User` et `X-Dev-Roles` pour les tests), le refus de `none` en production, l'en-tête `Server-Timing`, 7 tests. **Les 3 services l'utilisent déjà : ne change pas l'interface.**
- **Ce qui te reste dans ce module** : les modes `keycloak` et `auth0`. Ajoute un fichier `src/providers/jwt.js` (vérification avec `jose`, extraction des rôles par fournisseur) et branche-le dans `selectVerifier()` de `src/index.js`. Un jeton refusé lève une `AuthError('JETON_INVALIDE', …)`, qui est déjà transformée en `401`.
- **Service Catalogue** complet pour démarrer : les 5 routes, la validation, 10 produits de départ, 11 tests, le Dockerfile, le README. Il est dans ta partie.
- `infra/sso/` et `bench/sso/` : vides, à toi de jouer.

## Ta partie du dépôt

| Dossier / fichier       | Rôle                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `services/shared/auth/` | Middleware de vérification des jetons, utilisé par les 3 services |
| `services/catalogue/`   | Le service Catalogue                                              |
| `infra/sso/`            | Keycloak (compose + realm exporté)                                |
| `bench/sso/`            | Le banc de test                                                   |
| `fixtures/sso.json`     | Ta liste de mesures et scénarios                                  |

---

## Ce que tu livres

- [ ] **J1 — Découverte.** Créer le compte Auth0 (gratuit, **région UE**). Démarrer Keycloak en local. Lire les limites de débit du plan gratuit Auth0 et les noter dans `bench/sso/README.md`.
- [x] **J2 — `services/shared/auth` en mode `none`**, avec son interface définitive. _Livré dans le squelette._
- [ ] **J2-J3 — Modes `keycloak` et `auth0`** dans `services/shared/auth` (vérification JWT avec `jose`), sans changer l'interface.
- [ ] **J2 — Fixture** `fixtures/sso.json`.
- [x] **J2-J3 — Service Catalogue**, testé, avec son Dockerfile. _Livré dans le squelette : à toi de le faire évoluer._
- [ ] **J3 — Keycloak et Auth0 configurés à l'identique**, et le middleware qui fonctionne avec les deux.
- [ ] **J4 — Banc `bench/sso`**, premier lancement officiel.
- [ ] **J5 — Tableau forces / faiblesses / limites**, second lancement officiel, vidéo de démo.
- [ ] **Soutenance.** Politique de sécurité.

---

## Ce que tu attends des autres, ce qu'ils attendent de toi

| Sens                         | Quoi                                                                     | Quand  |
| ---------------------------- | ------------------------------------------------------------------------ | ------ |
| Lots 2 et 4 attendent de toi | `services/shared/auth` avec le mode `none` et l'interface ci-dessous     | Fin J2 |
| Lot 2 attend de toi          | Le Dockerfile du Catalogue, pour `infra/poc/compose.yml`                 | Fin J3 |
| Tu attends du Lot 1          | `results/schema.json` et la boîte à outils `@maison-epouvante/bench-kit` | Fin J1 |
| Tu attends du Lot 2          | La CI qui fait passer tes PR                                             | Fin J2 |

---

## Partie A — Le middleware partagé `services/shared/auth`

C'est un **workspace npm** (`@maison-epouvante/auth`). L'interface est figée dès le J2 ; le fonctionnement interne peut évoluer ensuite.

```js
import { createAuth } from '@maison-epouvante/auth';

const auth = createAuth({
  provider: process.env.SSO, // 'none' | 'keycloak' | 'auth0'
  issuer: process.env.SSO_ISSUER,
  audience: process.env.SSO_AUDIENCE,
  jwksUri: process.env.SSO_JWKS_URI,
});

app.post('/products', auth.requireRole('moderateur'), createProduct);
// dans le handler : req.user = { id, roles, provider }
```

| Situation                                           | Réponse                                                                                                                                                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pas de jeton                                        | `401` `{ "erreur": { "code": "NON_AUTHENTIFIE", … } }`                                                                                                                                              |
| Jeton invalide, expiré, falsifié, mauvaise audience | `401` `{ "erreur": { "code": "JETON_INVALIDE", … } }`                                                                                                                                               |
| Jeton valide sans le rôle                           | `403` `{ "erreur": { "code": "ROLE_MANQUANT", … } }`                                                                                                                                                |
| Mode `none`                                         | `req.user = { id: 'dev-membre', roles: ['membre', 'moderateur'], provider: 'none' }`. L'en-tête `X-Dev-User` peut changer l'`id` (tests). **Lève une erreur au démarrage si `NODE_ENV=production`** |

Conseils :

- Bibliothèque **`jose`** : `createRemoteJWKSet(new URL(jwksUri))` une seule fois au démarrage, puis `jwtVerify(token, jwks, { issuer, audience })`. Les clés publiques sont mises en cache : la vérification est locale, sans appel au fournisseur.
- **Les rôles ne sont pas au même endroit selon le fournisseur.** Isole ça dans une seule fonction `extractRoles(payload, provider)` :
  - Keycloak : `payload.realm_access.roles` ;
  - Auth0 : rien par défaut. Il faut une _Action_ post-login qui ajoute une revendication à espace de noms, par exemple `https://maison-epouvante.fr/roles`.
- **Mesure de la vérification** : ajoute l'en-tête standard `Server-Timing: auth;dur=<ms>` à chaque réponse. Le banc le lit pour la mesure `verification`, sans code spécial.
- Tests Vitest : génère toi-même une paire de clés avec `jose` (`generateKeyPair`), signe des jetons de test et sers un JWKS local. Tu testes tous les cas du tableau sans Keycloak ni Auth0.

---

## Partie B — Le service Catalogue

Les produits de la boutique, ceux qu'on trouve aussi en magasin.

| Route                  | Accès             | Comportement                           |
| ---------------------- | ----------------- | -------------------------------------- |
| `GET /health`          | public            | voir socle                             |
| `GET /products`        | public            | liste, filtre facultatif `?categorie=` |
| `GET /products/:id`    | public            | un produit, `404` sinon                |
| `POST /products`       | rôle `moderateur` | ajoute un produit, `201`               |
| `DELETE /products/:id` | rôle `moderateur` | retire un produit, `204`               |

- Champs d'un produit : `id`, `nom`, `categorie` (`figurines`, `blu-ray`, `bd`, `jeux`, `goodies`, `fanzine`), `prix` en centimes (entier, jamais de nombre à virgule pour de l'argent), `stock`, `exclusifEnLigne` (booléen).
- `data/products.json` : une dizaine de produits tirés du contexte (figurines Evil Ed exclusives au site, Blu-ray restauré, numéros du fanzine, BD « L'Orc », jeux de société).
- Validation du corps comme dans Troc (format d'erreur du socle).

---

## Partie C — Configurer Keycloak et Auth0 à l'identique

| Réglage                    | Keycloak                                      | Auth0                                                                                                                    |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Conteneur de l'application | Realm `maison-epouvante`                      | Le tenant (région UE)                                                                                                    |
| Client                     | Client `poc`, _Direct access grants_ activé   | _Application_ « poc », type _Regular Web Application_, type d'autorisation _Password_ activé dans les paramètres avancés |
| Audience des jetons        | _Audience mapper_ sur le client, valeur `poc` | Une _API_ dont l'identifiant sert d'audience. **Sans API, Auth0 renvoie un jeton opaque, non vérifiable**                |
| Rôles                      | Rôles de realm `membre`, `moderateur`         | Rôles `membre`, `moderateur` + l'_Action_ post-login qui les met dans le jeton                                           |
| Comptes de test            | `membre@test.local`, `moderateur@test.local`  | Les mêmes                                                                                                                |
| Durée de vie des jetons    | 5 min (_Access Token Lifespan_)               | 5 min (_Token Expiration_ de l'API)                                                                                      |
| Connexion par mot de passe | Natif                                         | _Default Directory_ du tenant = `Username-Password-Authentication`                                                       |

Conseils :

- `infra/sso/compose.yml` : image `quay.io/keycloak/keycloak` à **version épinglée**, commande `start-dev --import-realm`, dossier `infra/sso/realm/` monté sur `/opt/keycloak/data/import`. Les noms des variables d'administrateur et de santé ont changé selon les versions : vérifie-les dans la doc de **ta** version.
- **Exporter le realm** avec ses utilisateurs : l'export partiel de la console n'inclut pas les utilisateurs. Utilise la commande `kc.sh export --realm maison-epouvante --users realm_file` dans le conteneur, puis commite le fichier. Mots de passe de test uniquement.
- Auth0 se configure à la main : note **chaque clic** dans `bench/sso/README.md`, pour que n'importe qui puisse refaire la configuration.
- Le flux « mot de passe » est déconseillé en production (OAuth 2.1). On l'utilise seulement parce qu'il s'automatise sans navigateur. C'est une limite à citer, pas à cacher.

---

## Partie D — Le banc `bench/sso`

### Protocole

- `infra/sso/compose.yml` lance aussi une instance du Catalogue **dédiée au banc**, avec `cap_add: NET_ADMIN` et `iptables` installé. Elle ne sert jamais ailleurs.
- **Couper le fournisseur de façon identique pour les deux** : `docker exec <catalogue> iptables -A OUTPUT -p tcp --dport <port du fournisseur> -j DROP` (443 pour Auth0, 8080 pour Keycloak). Le service reste joignable depuis le banc, mais ne peut plus contacter le fournisseur. On retire la règle avec `-D` à la fin du scénario.
- Le banc lance d'abord tous les scénarios avec Keycloak (`SSO=keycloak`), puis avec Auth0 (`SSO=auth0`).
- La latence réseau vers chaque fournisseur est mesurée et publiée : elle explique une partie de l'écart.
- Une erreur `429` d'Auth0 pendant le banc est un **constat**, pas une panne du banc.
- Options, progression, statistiques et écriture du résultat : utilise `@maison-epouvante/bench-kit` (Lot 1). `writeResult()` valide le JSON et l'écrit proprement, ne le refais pas à la main.

### Mesures

| id                     | Libellé                                 | Catégorie    | Unité | Meilleur | Comment                                              |
| ---------------------- | --------------------------------------- | ------------ | ----- | -------- | ---------------------------------------------------- |
| `jeton_p50`            | Obtention d'un jeton, médiane           | Performance  | ms    | bas      | 100 demandes successives (flux « mot de passe »)     |
| `jeton_p95`            | Obtention d'un jeton, p95               | Performance  | ms    | bas      | Les mêmes 100 demandes                               |
| `jeton_charge_p95`     | Obtention d'un jeton sous charge, p95   | Performance  | ms    | bas      | 20 demandes simultanées, 5 vagues                    |
| `verification`         | Vérification d'un jeton par le service  | Performance  | ms    | bas      | En-tête `Server-Timing`                              |
| `requete_protegee_p95` | Appel complet d'une route protégée, p95 | Performance  | ms    | bas      | 100 `POST /products` avec jeton                      |
| `latence_reseau`       | Aller-retour vers le fournisseur        | Performance  | ms    | bas      | `GET /.well-known/openid-configuration`              |
| `demarrage`            | Démarrage jusqu'à « prêt »              | Exploitation | s     | bas      | Keycloak. Auth0 : `null` + note « service en ligne » |
| `memoire`              | Mémoire au repos                        | Ressources   | Mo    | bas      | `docker stats`. Auth0 : `null`                       |

### Scénarios

| id                                   | Ce qu'on provoque                                      | Sain attendu                | Ce qu'on relève                                                             |
| ------------------------------------ | ------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------- |
| `jeton_falsifie`                     | Rôle `moderateur` ajouté dans le jeton, sans re-signer | `401`                       | Code reçu                                                                   |
| `jeton_expire`                       | Jeton réutilisé après ses 5 minutes                    | `401`                       | Code reçu                                                                   |
| `mauvaise_audience`                  | Jeton émis pour un autre client ou une autre API       | `401`                       | Code reçu                                                                   |
| `fournisseur_coupe_connexion`        | Fournisseur coupé, nouvelle connexion                  | Échec propre, message clair | Ce que voit l'utilisateur : point unique de défaillance                     |
| `fournisseur_coupe_jetons_existants` | Fournisseur coupé, jetons déjà émis                    | Acceptés jusqu'à expiration | Acceptés ou non, et pourquoi (cache des clés)                               |
| `revocation`                         | Compte désactivé après avoir reçu un jeton             | Accès coupé aussitôt        | Secondes pendant lesquelles l'accès reste possible (appel toutes les 5 s)   |
| `force_brute`                        | 10 mauvais mots de passe, puis le bon                  | Compte ou adresse bloqué    | Bloqué ou non, après combien d'essais, **avec la configuration par défaut** |
| `montee_en_charge`                   | 50 connexions simultanées                              | Toutes réussissent          | Nombre d'échecs, nombre de `429`                                            |

Pour `revocation`, le résultat attendu est un « KO » des deux côtés : un jeton JWT reste valide jusqu'à son expiration, car le service ne redemande rien au fournisseur. C'est **le** constat à expliquer à l'oral. Parade possible : l'introspection de jeton, proposée par Keycloak et pas par Auth0 pour ses jetons d'accès. C'est une ligne du tableau comparatif.

---

## Pièges connus

- **Jeton opaque Auth0** : pas d'API déclarée = pas de JWT. C'est le piège n°1.
- **Audience Keycloak** : sans _audience mapper_, `aud` vaut `account` et la vérification échoue.
- **Horloge** : un écart d'horloge entre conteneurs fait échouer `exp`/`nbf`. Autorise `clockTolerance: 5` secondes, pas plus.
- **Quotas Auth0** : ne lance pas le banc complet en boucle pendant le développement. Utilise `--rapide`.
- **Secrets Auth0** : `AUTH0_CLIENT_SECRET` uniquement dans `.env` et dans les secrets de la CI. Le dépôt est public.

---

## Pour la soutenance — la politique de sécurité

Elle couvre la nouvelle plateforme **et** le SI existant : stock, CRM, caisses des 4 magasins, serveur de fichiers de Paris (accès VPN, sauvegardes Veeam), infrastructure média d'Evil Ed, site vitrine CMS, Gmail. Axes demandés par la consigne :

1. **Inventaire du parc applicatif** : un registre vivant de chaque application, avec ses versions, son propriétaire, les données qu'elle traite et son exposition. Mis à jour à chaque mise en production.
2. **Scans de sécurité** : ceux du pipeline (code, secrets, dépendances, images), plus des scans réguliers de l'infrastructure, des tests dynamiques sur l'application déployée et un test d'intrusion annuel.
3. **Supervision des applications et des infrastructures** : journaux centralisés, alertes sur les comportements suspects (échecs de connexion en rafale…), tableaux de bord.
4. **Analyse des risques et gestion des incidents** : une méthode d'analyse (par exemple EBIOS RM, ou une matrice probabilité × impact) et un processus d'incident : détecter, qualifier, contenir, corriger, rétablir, tirer les leçons. Avec la notification à la CNIL sous 72 h en cas de fuite de données personnelles (RGPD).
5. **Identités et accès** : SSO, double authentification pour les comptes sensibles, moindre privilège. Le paiement passe par un prestataire certifié : la plateforme ne stocke jamais de numéro de carte.
6. **Amélioration continue** : la boucle « planifier, faire, vérifier, corriger » : chaque incident et chaque scan alimente la suivante.

Montre comment chaque axe s'insère dans le cycle DevSecOps du Lot 2.

---

## Terminé quand

- [ ] Le même Catalogue accepte un jeton Keycloak ou Auth0 en changeant seulement `SSO` et ses 3 URL.
- [ ] Les tests du middleware couvrent tous les cas du tableau de la partie A, sans réseau.
- [ ] Les 8 scénarios ont un statut pour les deux fournisseurs.
- [ ] 2 lancements officiels dans `results/sso/`, plus le README (configuration Auth0 pas à pas incluse).

---

## Prompt de départ pour ton IA

> Je travaille sur un projet étudiant (monorepo Node.js 22, modules ES, Express, Vitest, Docker). Je te joins `docs/socle-commun.md` (conventions et contrat de données, qui font foi) et `docs/lots/lot-3-sso.md` (ma mission). Respecte strictement le socle et `CONTRIBUTING.md`. Commence par le workspace `services/shared/auth` : l'interface `createAuth` / `requireRole` exactement comme décrite, le mode `none`, la vérification avec `jose`, et des tests Vitest qui signent leurs propres jetons. Code propre ; code, commentaires et noms de tests en anglais (voir CONTRIBUTING.md, « Code et langue »).
