# Banc brokers — Kafka vs RabbitMQ

> En cours de rédaction : le protocole, les hypothèses de départ et les limites arrivent avec le banc (J4).

## Réglages exacts de chaque mode

Le banc passe par les adaptateurs de `services/shared/messaging` : ce sont leurs réglages qui sont mesurés, pas ceux par défaut des bibliothèques.

### RabbitMQ (`amqplib`)

| Réglage                 | Mode par défaut                          | Mode `secure: true`                 |
| ----------------------- | ---------------------------------------- | ----------------------------------- |
| Messages                | non persistants (`deliveryMode: 1`)      | persistants (`deliveryMode: 2`)     |
| Confirmation du broker  | aucune, `publish` n'attend que le réseau | `publish` attend l'accusé (confirm) |
| Prefetch (consommateur) | **1**                                    | **1**                               |
| Files                   | classiques, durables                     | classiques, durables                |

**Prefetch à 1** : RabbitMQ n'envoie au consommateur qu'un message non acquitté à la fois, et le stock reste dans le broker au lieu de remplir la mémoire du service. Contrepartie : un aller-retour d'accusé par message, donc un débit de bout en bout plus bas qu'avec un prefetch plus large. Ce n'est pas la valeur par défaut de RabbitMQ (sans limite) : c'est celle du POC, donc celle qu'on mesure.

### Kafka (`@confluentinc/kafka-javascript`, `librdkafka` 2.16)

| Réglage                      | Mode par défaut                              | Mode `secure: true`         |
| ---------------------------- | -------------------------------------------- | --------------------------- |
| Producteur                   | non idempotent                               | **idempotent**              |
| Accusé du broker (`acks`)    | `-1` (tous les réplicas), `publish` l'attend | `-1`, `publish` l'attend    |
| Enregistrement des positions | automatique, toutes les 5 s                  | automatique, toutes les 5 s |
| Topic                        | 3 partitions, 1 réplica (un seul nœud)       | 3 partitions, 1 réplica     |
| Traitement                   | un message à la fois par consommateur        | un message à la fois        |

**Différence avec RabbitMQ en mode par défaut** : le `publish` Kafka attend l'accusé du broker, celui de RabbitMQ non. C'est le comportement par défaut de chaque client, donc ce qu'on mesure : le débit d'envoi de Kafka en mode par défaut inclut cette attente.
