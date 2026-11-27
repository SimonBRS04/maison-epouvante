# Banc brokers — Kafka vs RabbitMQ

> En cours de rédaction : le protocole, les hypothèses de départ et les limites arrivent avec le banc (J4), les réglages Kafka avec son adaptateur (J3).

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
