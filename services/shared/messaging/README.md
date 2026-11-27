# `@maison-epouvante/messaging` — Lot 4

Publication et consommation d'événements, avec le même code pour les trois brokers. Le broker se choisit avec `BROKER` (`memory`, `rabbitmq`, `kafka`). Contexte et sémantique attendue : [`docs/lots/lot-4-brokers.md`](../../../docs/lots/lot-4-brokers.md), partie A.

```js
import { createPublisher, createSubscriber } from '@maison-epouvante/messaging';

const publisher = await createPublisher({ broker: process.env.BROKER });
await publisher.publish('offers', event, { key: event.membreId });

const subscriber = await createSubscriber({ broker: process.env.BROKER, group: 'notifications' });
await subscriber.subscribe('offers', async (event) => {
  // lever une erreur = message refusé, il sera redistribué
});
```

| Adaptateur | État        | Bibliothèque                     |
| ---------- | ----------- | -------------------------------- |
| `memory`   | fait        | aucune (dans le processus)       |
| `rabbitmq` | fait        | `amqplib`                        |
| `kafka`    | J3, à venir | `@confluentinc/kafka-javascript` |

## RabbitMQ : réglages exacts

| Élément               | Valeur                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| URL                   | `RABBITMQ_URL` (défaut `amqp://guest:guest@localhost:5672`)                                               |
| Topologie             | exchange `<topic>` de type `topic`, durable ; file durable `<topic>.<group>` liée avec `#`                |
| Mode par défaut       | canal simple, messages **non persistants** (`deliveryMode: 1`), pas de confirmation du broker             |
| `secure: true`        | canal à confirmations (`publish` attend l'accusé du broker), messages **persistants** (`deliveryMode: 2`) |
| `prefetch: n`         | `n` messages non acquittés au plus par consommateur ; illimité par défaut                                 |
| `fromBeginning`       | sans effet : une file classique ne garde rien de ce qui précède sa création                               |
| Acquittement          | `ack` après le traitement ; erreur du traitement → `nack` avec remise en file                             |
| Message JSON invalide | rejeté sans remise en file (sinon il boucle à l'infini), et journalisé                                    |

## Comportements à connaître

- **Reconnexion** : on utilise celle **intégrée à `amqplib`** (option `recovery`, disponible depuis la version 1.1). Attentes de 1 s, 2 s, 4 s, 8 s, 8 s, sans aléa, soit environ 23 s d'essais, puis abandon. Après chaque reconnexion, les échanges, files et consommateurs sont recréés.
- **Pendant une coupure**, `publish()` **attend** la reconnexion au lieu d'échouer. Vérifié le 2026-11-27 : broker tué avec `docker kill`, relancé 10 s plus tard ; l'offre créée pendant la coupure a mis 14 s à répondre `201`, et sa notification est bien arrivée. Si la reconnexion échoue, `publish()` lève une erreur (Troc répond alors `503`).
- **Un message à la fois par abonné** : `amqplib` n'attend pas la fin d'un traitement asynchrone avant de livrer le suivant. L'adaptateur les enchaîne, comme Kafka, pour que le désordre mesuré par le banc vienne du broker et des consommateurs concurrents, pas de notre code.
- **Au moins une fois** : un message traité mais pas encore acquitté au moment d'une coupure est relivré. D'où l'idempotence du service Notifications.
- **Limite** : les files classiques ne comptent pas les livraisons. Un traitement qui échoue toujours fait boucler son message. Les files _quorum_ ont une limite de livraisons : piste d'amélioration à citer.
- Chaque connexion porte un nom visible dans la console RabbitMQ (onglet _Connections_), par exemple `maison-epouvante/subscriber/notifications (pid 4242)`.

## Tests

```bash
npm test -w services/shared/messaging
```

Les tests d'intégration RabbitMQ ne tournent que si un broker répond sur `localhost:5672` ; sinon ils sont ignorés (c'est le cas dans la CI). Pour les lancer :

```bash
docker compose -f infra/brokers/compose.yml up -d --wait rabbitmq
npm test -w services/shared/messaging
```
