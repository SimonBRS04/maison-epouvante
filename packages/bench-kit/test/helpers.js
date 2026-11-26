/** A minimal valid result, used as the starting point of every validation test. */
export function buildResult() {
  return {
    version: 1,
    comparatif: 'brokers',
    date: '2026-12-01T14:30:00Z',
    duree_s: 412,
    environnement: {
      machine: 'pc-demo',
      os: 'Windows_NT 10.0.22631',
      cpu: 'Intel Core i7',
      ram_go: 16,
      commit: 'a1b2c3d',
    },
    technos: [
      { id: 'kafka', nom: 'Kafka', version: '3.9.0' },
      { id: 'rabbitmq', nom: 'RabbitMQ', version: '4.0.5' },
    ],
    mesures: [
      {
        id: 'latence_p95',
        libelle: 'Latence p95',
        categorie: 'Performance',
        unite: 'ms',
        meilleur: 'bas',
        repetitions: 5,
        valeurs: {
          kafka: { mediane: 12, min: 11, max: 14 },
          rabbitmq: { mediane: 4, min: 3, max: 6 },
        },
      },
    ],
    scenarios: [
      {
        id: 'panne_broker_defaut',
        libelle: 'Panne du broker en plein envoi',
        categorie: 'Fiabilité',
        attendu: 'Aucun message perdu',
        resultats: {
          kafka: { statut: 'OK', constat: 'Aucune perte observée' },
          rabbitmq: {
            statut: 'KO',
            constat: 'Messages perdus pendant la coupure',
            valeur: 312,
            unite: 'messages perdus',
          },
        },
      },
    ],
    erreurs: [],
  };
}
