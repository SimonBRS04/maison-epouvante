# Lot 4 — Brokers : Kafka vs RabbitMQ, et service Notifications

**Responsable : ____________**
À lire avant ce fichier : [`docs/socle-commun.md`](../socle-commun.md) et [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

---

## Ta mission en une phrase

L'événement `offer.created` (Troc → Notifications) passe indifféremment par Kafka ou par RabbitMQ, avec le même code. Ton banc de test mesure vitesse et ressources, puis provoque désordre et pannes pour montrer ce que chacun garantit vraiment.

## Pourquoi c'est important

Ton comparatif compte pour la démonstration « 2 technologies pour l'application » (3 points). C'est celui où les différences sont les plus spectaculaires : messages perdus, doublons, désordre. Tu fournis aussi le module de messagerie que Troc utilise pour publier : sans lui, le POC ne communique pas. Enfin, tu couvres trois parties de la soutenance : **orchestrateur**, **attributs qualité**, **métiers** (5 points).

---

## Déjà en place dans le squelette

- **`services/shared/messaging`** : l'interface définitive (`createPublisher`, `createSubscriber`), l'adaptateur `memory` (copie par groupe, partage dans un groupe, redistribution sur erreur, sérialisation JSON), 7 tests. **Troc et Notifications l'utilisent déjà : ne change pas l'interface.**
- **Ce qui te reste dans ce module** : les adaptateurs `src/adapters/kafka.js` et `src/adapters/rabbitmq.js`, branchés dans `createPublisher()` et `createSubscriber()` de `src/index.js`, avec les options `secure`, `fromBeginning`, `prefetch`. **Priorité : RabbitMQ d'abord**, car le Lot 2 en a besoin pour `infra/poc` au J3.
- **Service Notifications** complet pour démarrer : la consommation de `offer.created`, les centres d'intérêt, l'idempotence, la route, les deux stockages (mémoire et PostgreSQL, choisis par `STORE`), les tests, le Dockerfile, le README. Il est dans ta partie.
- `infra/brokers/` et `bench/brokers/` : vides, à toi de jouer.

## Ta partie du dépôt

| Dossier / fichier            | Rôle                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `services/shared/messaging/` | Publication et consommation d'événements : adaptateurs `memory`, `kafka`, `rabbitmq` |
| `services/notifications/`    | Le service Notifications                                                             |
| `infra/brokers/compose.yml`  | Kafka + RabbitMQ                                                                     |
| `bench/brokers/`             | Le banc de test                                                                      |
| `fixtures/brokers.json`      | Ta liste de mesures et scénarios                                                     |

---

## Ce que tu livres

- [ ] **J1 — Découverte.** Démarrer Kafka et RabbitMQ en local, envoyer un message dans chacun à la main.
- [x] **J2 — `services/shared/messaging` avec l'adaptateur `memory`**, et l'interface définitive. _Livré dans le squelette._
- [ ] **J2 — Fixture** `fixtures/brokers.json`.
- [x] **J2-J3 — Service Notifications**, testé, avec son Dockerfile. _Livré dans le squelette : à toi de le faire évoluer._
- [ ] **J3 — Adaptateurs `kafka` et `rabbitmq`**, avec reconnexion. Inclut un `npm ci` et un envoi Kafka **sur le PC de démo Windows** (voir « Décisions du lot »).
- [ ] **J4 — Banc `bench/brokers`**, premier lancement officiel.
- [ ] **J5 — Tableau forces / faiblesses / limites**, second lancement officiel, vidéo de démo.
- [ ] **Soutenance.** Schéma de l'orchestrateur Kubernetes, attributs qualité, métiers et interactions.

---

## Ce que tu attends des autres, ce qu'ils attendent de toi

| Sens                | Quoi                                                                                | Quand  |
| ------------------- | ----------------------------------------------------------------------------------- | ------ |
| Lot 2 attend de toi | `services/shared/messaging` avec `memory` et l'interface ci-dessous                 | Fin J2 |
| Lot 2 attend de toi | Le Dockerfile de Notifications et l'adaptateur `rabbitmq` (utilisé par `infra/poc`) | Fin J3 |
| Tu attends du Lot 3 | `services/shared/auth` (protège `GET /notifications`)                               | Fin J2 |
| Tu attends du Lot 1 | `results/schema.json` et la boîte à outils `@maison-epouvante/bench-kit`            | Fin J1 |

---

## Partie A — Le module partagé `services/shared/messaging`

C'est un **workspace npm** (`@maison-epouvante/messaging`). L'interface est figée dès le J2.

```js
import { createPublisher, createSubscriber } from '@maison-epouvante/messaging';

// Publication (Troc, banc)
const publisher = await createPublisher({ broker: process.env.BROKER });
await publisher.publish('offers', event, { key: event.membreId });
await publisher.close();

// Consommation (Notifications, banc)
const subscriber = await createSubscriber({ broker: process.env.BROKER, group: 'notifications' });
await subscriber.subscribe('offers', async (event) => {
  // traitement ; lever une erreur = message refusé, il sera redistribué
});
await subscriber.close();
```

Options facultatives, utilisées surtout par le banc :

| Option                | Effet Kafka                                | Effet RabbitMQ                                    |
| --------------------- | ------------------------------------------ | ------------------------------------------------- |
| `secure: true`        | producteur idempotent, `acks: -1`          | canal à confirmations, messages persistants       |
| `fromBeginning: true` | lecture depuis le premier message du topic | sans effet (une file classique ne garde rien)     |
| `prefetch: n`         | sans effet                                 | nombre de messages non acquittés par consommateur |

**Même sémantique des deux côtés** :

- Kafka : topic `offers` à 3 partitions, `group` = _consumer group_.
- RabbitMQ : un _exchange_ `offers` (type `topic`), une file durable `offers.<group>` liée à lui. Même `group` = consommateurs concurrents sur la même file ; groupes différents = chacun reçoit sa copie. C'est l'équivalent exact des groupes Kafka.
- `memory` : un `EventEmitter` dans le processus, mêmes règles. Sert aux tests unitaires et au développement.

Conseils :

- Bibliothèques : `@confluentinc/kafka-javascript` (client officiel de Confluent, API compatible `kafkajs`) et `amqplib`. **Choix revu le 2026-11-27** : on n'utilise plus `kafkajs`. Pourquoi, et ce que ça change : voir [« Décisions du lot »](#décisions-du-lot).
- **Reconnexion** : le client Kafka réessaie tout seul. `amqplib` sait aussi se reconnecter depuis sa version 1.1, mais **seulement si on l'active** (option `recovery`) : sans elle, une connexion perdue est perdue et la comparaison des pannes est faussée. Documente les délais choisis : c'est un constat en soi (la bibliothèque cliente compte autant que le broker). Voir [« Décisions du lot »](#décisions-du-lot).
- **Valeurs par défaut** : les bibliothèques n'ont pas les mêmes. Côté Kafka, ce sont celles de `librdkafka` (la bibliothèque C du client Confluent) : `acks` vaut par exemple déjà « tous les réplicas » par défaut, mais le producteur n'est pas idempotent. Note dans le README du banc les réglages exacts de chaque mode.
- Messages en JSON (`Buffer.from(JSON.stringify(event))`).
- Tests Vitest sur l'adaptateur `memory`, plus un test d'intégration par vrai broker (lancé seulement si le broker répond, sinon ignoré).

---

## Partie B — Le service Notifications

Il prévient les membres quand un article lié à leurs centres d'intérêt est proposé au troc.

| Route                | Accès         | Comportement                                                                                                 |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /health`        | public        | voir socle                                                                                                   |
| `GET /notifications` | rôle `membre` | les notifications du membre connecté (`req.user.id`). Un `moderateur` voit tout, avec un filtre `?membreId=` |

- Consomme `offer.created` (groupe `notifications`). Pour chaque membre dont les centres d'intérêt (`data/interests.json` : `{ "m-001": ["figurines", "bd"], … }`) contiennent la catégorie de l'offre, sauf l'auteur de l'offre, il crée une notification : `{ id, membreId, offerId, titre, creeA, lue: false }`.
- **Idempotence** (déjà en place) : les deux brokers peuvent livrer un message deux fois. Le stockage enregistre l'`id` de chaque événement traité (table `processed_events` en PostgreSQL) et ignore les doublons. C'est la parade aux doublons que ton banc va montrer : explique-le à l'oral.
- Données en mémoire.

---

## Partie C — Le banc `bench/brokers`

### Infrastructure

- `infra/brokers/compose.yml`, avec `name: maison-epouvante` en tête comme tous les compose du projet, versions **épinglées** :
  - Kafka : image `apache/kafka`, mode KRaft (sans ZooKeeper), un seul nœud.
  - RabbitMQ : image `rabbitmq:<version>-management`, console sur le port 15672.
- Ressources : `cpus: "2"`, `mem_limit: 2g` pour chacun.
- **Piège n°1, les _listeners_ Kafka** : le banc tourne sur l'hôte, les services dans des conteneurs. Il faut deux listeners annoncés : `localhost:9092` pour l'hôte, `kafka:29092` pour le réseau Docker. Sans ça, le client se connecte puis échoue mystérieusement.
- Le topic `offers` (3 partitions) est créé par le banc au démarrage, avec le client d'administration du client Kafka (`admin.createTopics`). Ne compte pas sur la création automatique.
- Un seul nœud chacun. Limite à citer : la réplication entre nœuds n'est pas testée.

### Protocole

- Le banc utilise **les adaptateurs du module partagé**, pas un code à part : on teste le vrai code du POC.
- Événement du socle, enrichi d'un `seq` (numéro de séquence). La latence se calcule à la réception, à partir de `envoyeA` (même machine, même horloge).
- Traitement simulé par une attente fixe : `(seq % 3) × 10 ms`. Pas de hasard : le résultat est reproductible.
- Les consommateurs « à tuer » tournent dans un **processus enfant** (`child_process.fork`), pour pouvoir les arrêter net (`SIGKILL`) en plein traitement.
- Les pannes du broker : `docker kill`, puis `docker start` 10 s plus tard.
- Ordre : une technologie, toutes ses mesures, arrêt ; puis l'autre.
- Options, progression, statistiques et écriture du résultat : utilise `@maison-epouvante/bench-kit` (Lot 1). `writeResult()` valide le JSON et l'écrit proprement, ne le refais pas à la main.

### Mesures

| id                   | Libellé                    | Catégorie    | Unité | Meilleur | Comment                                          |
| -------------------- | -------------------------- | ------------ | ----- | -------- | ------------------------------------------------ |
| `latence_p50`        | Latence, médiane           | Performance  | ms    | bas      | 1 000 messages à 100 messages/s                  |
| `latence_p95`        | Latence, p95               | Performance  | ms    | bas      | Les mêmes 1 000 messages                         |
| `debit_envoi`        | Débit d'envoi              | Performance  | msg/s | haut     | 100 000 messages envoyés au plus vite            |
| `debit_bout_en_bout` | Débit de bout en bout      | Performance  | msg/s | haut     | Les mêmes, jusqu'à consommation du dernier       |
| `demarrage`          | Démarrage jusqu'à « prêt » | Exploitation | s     | bas      | De `docker start` au premier message accepté     |
| `memoire_repos`      | Mémoire au repos           | Ressources   | Mo    | bas      | `docker stats --no-stream --format "{{json .}}"` |
| `memoire_charge`     | Mémoire en charge          | Ressources   | Mo    | bas      | Pendant le test de débit                         |
| `cpu_charge`         | CPU en charge              | Ressources   | %     | bas      | Pendant le test de débit                         |

### Scénarios

| id                          | Ce qu'on provoque                                                    | Sain attendu                 | Ce qu'on relève                                                                                 |
| --------------------------- | -------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `ordre_multi_consommateurs` | 1 000 messages d'un même membre, 3 consommateurs du même groupe      | Traités dans l'ordre         | Nombre de messages traités dans le désordre, et combien de consommateurs ont vraiment travaillé |
| `ordre_rejet`               | Le traitement échoue une fois sur 10 messages, qui sont redistribués | Ordre conservé, aucune perte | Messages hors ordre, doublons, ou consommation bloquée                                          |
| `panne_broker_defaut`       | Broker tué au 5 000e message sur 10 000, réglages par défaut         | Ni perte ni doublon          | Messages perdus, doublons                                                                       |
| `panne_broker_securise`     | Même panne avec `secure: true`                                       | Ni perte ni doublon          | Perdus, doublons, et ce que coûtent ces réglages en débit                                       |
| `panne_consommateur`        | Consommateur tué en plein traitement, avant son acquittement         | Message redistribué          | Perdu, retraité, en double                                                                      |
| `relecture`                 | Un nouveau groupe s'abonne après coup                                | Il peut relire l'historique  | Possible ou non                                                                                 |

**Compter le désordre** : chaque consommateur note `(seq, heure de fin)`. On trie par heure de fin et on compte les messages dont le `seq` est plus petit qu'un `seq` déjà vu. Ce nombre est la `valeur` du scénario.

**Hypothèses de départ**, à écrire dans le README et à confirmer ou démentir par les mesures : Kafka offre plus de débit ; RabbitMQ a moins de latence à faible charge ; RabbitMQ perd l'ordre avec plusieurs consommateurs ; Kafka garde l'ordre par clé, mais un seul consommateur travaille alors. Un résultat qui contredit une hypothèse se présente tel quel à l'oral.

**Nuance à citer** dans le tableau comparatif : RabbitMQ propose aussi des _Streams_ qui permettent la relecture. On teste les files classiques, l'usage le plus courant.

---

## Décisions du lot

Les choix qui s'écartent de ce fichier, avec leur raison, pour que toute l'équipe sache pourquoi le code ne suit pas le conseil d'origine.

### 2026-11-27 — Client Kafka : `@confluentinc/kafka-javascript` au lieu de `kafkajs`

**Le problème.** Ce fichier conseillait `kafkajs`. Sa dernière version (2.2.4) date de février 2023 : la bibliothèque n'est plus maintenue.

**L'argument qui a tranché.** Le banc ne mesure jamais « Kafka » seul, mais **le broker et sa bibliothèque cliente ensemble**. Mesurer avec `kafkajs` puis recommander un autre client pour la production fausserait la comparaison : nos chiffres décriraient un logiciel que personne ne déploierait. Règle retenue : **chaque broker est testé avec le client qu'on utiliserait en production**.

| Broker   | Client de production             | Pourquoi                                                                        |
| -------- | -------------------------------- | ------------------------------------------------------------------------------- |
| RabbitMQ | `amqplib`                        | La référence en Node.js, maintenue                                              |
| Kafka    | `@confluentinc/kafka-javascript` | Le client officiel de Confluent, maintenu ; `kafkajs` ne l'est plus depuis 2023 |

**Vérifié le 2026-11-27**, avec le Kafka 4.4.0 de `infra/brokers/compose.yml` (création du topic à 3 partitions, producteur idempotent, consommation en groupe) :

- `kafkajs` 2.2.4 fonctionne encore avec Kafka 4.4 ;
- le client Confluent 1.11.0 fonctionne sous macOS, et s'installe et se charge dans `node:22-alpine` (l'image des Dockerfiles) ;
- **pas encore testé sous Windows.**

**Ce que ça change.**

- **Installation** : le client embarque `librdkafka` (en C). À chaque `npm ci`, il télécharge depuis GitHub un binaire précompilé pour le système : macOS, Windows x64, Linux et Alpine en ont un. Sans accès à GitHub, il tente une compilation C++, qui échoue dans l'image Alpine.
- **Poids** : environ 40 Mo installés, contre 1,8 Mo pour `kafkajs`. `messaging` est une dépendance de Troc et de Notifications : **leurs deux images Docker grossissent d'environ 37 Mo**, même quand elles utilisent RabbitMQ.
- **Pour le Lot 2** : images plus lourdes, builds un peu plus longs, et une bibliothèque C de plus pour Trivy (`scan_images`).
- **Code** : presque le même que pour `kafkajs`, grâce à l'API compatible. Les options passent dans un bloc `kafkaJS: { … }`, et certaines changent de place (`fromBeginning` à la création du consommateur, plus dans `subscribe()`).
- **Banc** : les réglages par défaut sont ceux de `librdkafka`, à relever dans `bench/brokers/README.md`. Le client Kafka est écrit en C, `amqplib` en JavaScript : ce n'est pas un biais, c'est ce que la direction aurait en production. À dire tel quel à l'oral.

**Risque et parade.**

- **PC de démo Windows** : `npm ci` et un envoi Kafka à tester dessus **dès le J3**, pas la veille de la soutenance.
- **Repli** : l'adaptateur est écrit pour que revenir à `kafkajs` se fasse en changeant l'import. Si on doit s'en servir, on le note ici avec la raison, et dans le README du banc.

**Bonus possible pour l'oral** : un lancement de développement avec `kafkajs` chiffrerait l'effet de la bibliothèque cliente sur le débit.

### 2026-11-27 — Reconnexion RabbitMQ : celle d'`amqplib`, pas une maison

**Le problème.** Ce fichier disait qu'`amqplib` ne se reconnecte pas et demandait d'écrire une reconnexion à la main. C'était vrai des anciennes versions (0.10.x). Depuis la 1.1, `amqplib` a sa propre reconnexion, à activer avec l'option `recovery` ; on utilise la 2.4.2.

**Décision.** On active celle d'`amqplib`, pour la même raison que le choix du client Kafka : tester le client tel qu'on l'utiliserait en production. Délais : 1, 2, 4, 8, 8 s (environ 23 s), sans aléa pour que les lancements restent reproductibles.

**Vérifié le 2026-11-27** : broker tué avec `docker kill`, relancé 10 s plus tard. Troc et Notifications se reconnectent seuls ; l'offre créée pendant la coupure attend la reconnexion (14 s) puis est bien notifiée. Détail des réglages : `services/shared/messaging/README.md`.

---

## Pièges connus

- **Listeners Kafka** (voir plus haut) : la cause n°1 des « ça marche dans le conteneur mais pas depuis l'hôte ».
- **Topic avec 1 partition** : si la création automatique l'a créé avant ton banc, le scénario d'ordre ne veut plus rien dire. Supprime-le et recrée-le à 3 partitions.
- **File RabbitMQ qui garde des messages d'un lancement précédent** : purge les files au début de chaque scénario.
- **Consommateurs dans le même processus que le producteur** : impossible de tuer l'un sans l'autre. D'où le processus enfant.
- **Mesure faussée par les logs** : n'écris rien sur la console par message pendant les tests de débit.

---

## Pour la soutenance

1. **Schéma de l'orchestrateur Kubernetes** (fait maison) : le plan de contrôle (serveur d'API, etcd, ordonnanceur, gestionnaire de contrôleurs) et les nœuds de travail (kubelet, kube-proxy, moteur de conteneurs, pods). Explique le trajet d'un déploiement : on décrit l'état voulu, l'API l'enregistre dans etcd, l'ordonnanceur choisit un nœud, le kubelet démarre les conteneurs, les contrôleurs corrigent tout écart.
2. **Attributs qualité**, chacun défini en une phrase et justifié par le contexte :
   - sécurité (plateforme commerciale, contrainte forte du client) ;
   - disponibilité (vente en ligne permanente, pics pendant le festival) ;
   - performance (interface « fluide » exigée) ;
   - scalabilité (pics de trafic du festival, futures enchères et diffusion vidéo) ;
   - maintenabilité (petite équipe de 3 personnes) ;
   - accessibilité (RGAA exigé) ;
   - conformité (RGPD, hébergement en Europe).
3. **Métiers et interactions** : architecte logiciel, développeurs, DevOps, responsable sécurité, testeur, product owner (côté direction), designer UX/UI (RGAA), DPO (RGPD), administrateur système (SI existant), modérateur de la communauté (côté métier). Un schéma qui montre qui échange quoi avec qui (besoins, livrables, alertes) vaut mieux qu'une liste.

---

## Terminé quand

- [ ] Troc publie et Notifications reçoit, en changeant seulement `BROKER` (`memory`, `kafka`, `rabbitmq`).
- [ ] Un doublon d'événement ne crée pas de doublon de notification.
- [ ] Les 6 scénarios ont un statut pour les deux brokers.
- [ ] 2 lancements officiels dans `results/brokers/`, plus le README (réglages exacts de chaque mode inclus).

---

## Prompt de départ pour ton IA

> Je travaille sur un projet étudiant (monorepo Node.js 24, modules ES, Express, Vitest, Docker). Je te joins `docs/socle-commun.md` (conventions et contrat de données, qui font foi) et `docs/lots/lot-4-brokers.md` (ma mission). Respecte strictement le socle et `CONTRIBUTING.md`. Commence par le workspace `services/shared/messaging` : l'interface `createPublisher` / `createSubscriber` exactement comme décrite, l'adaptateur `memory` et ses tests Vitest. Code propre ; code, commentaires et noms de tests en anglais (voir CONTRIBUTING.md, « Code et langue »).
