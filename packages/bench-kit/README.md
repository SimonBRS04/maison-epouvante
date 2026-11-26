# `@maison-epouvante/bench-kit` — Lot 1

La boîte à outils commune des 3 bancs. Elle garantit qu'ils lisent leurs options, annoncent leur progression, calculent leurs statistiques et écrivent leurs résultats **exactement de la même façon**. Contrat d'exécution : [`bench/README.md`](../../bench/README.md). Format des résultats : [`results/schema.json`](../../results/schema.json).

## API

| Fonction                               | Rôle                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `parseArgs()`                          | Lit `--officiel`, `--rapide`, `--collecte-seule`, `--repetitions` → `{ official, quick, collectOnly, repetitions, warmup }` |
| `step(texte)`                          | Affiche `ETAPE=<texte>` (progression lue par le dashboard)                                                                  |
| `measure(fn, { repetitions, warmup })` | Lance `fn` plusieurs fois (échauffement ignoré) → `{ mediane, min, max }`                                                   |
| `median(valeurs)`                      | Médiane                                                                                                                     |
| `percentile(valeurs, p)`               | Percentile, méthode du rang le plus proche (toujours une valeur réellement mesurée)                                         |
| `environment()`                        | Bloc `environnement` : machine, OS, CPU, RAM, commit                                                                        |
| `validateResult(json)`                 | `{ valid, errors }` : schéma JSON + règles de cohérence                                                                     |
| `writeResult(json, { official })`      | Valide, écrit de façon atomique, affiche `RESULTAT=…` ; si invalide → `rejets/` et code de sortie 2                         |

## Squelette d'un banc

```js
import { environment, measure, parseArgs, step, writeResult } from '@maison-epouvante/bench-kit';

const args = parseArgs();
const startedAt = Date.now();

step('Démarrage de Kafka');
// docker compose up… (dans un try/finally pour toujours arrêter les conteneurs)

step('Mesure de la latence');
const latencyKafka = await measure(() => measureLatencyOnce('kafka'), args);

await writeResult(
  {
    version: 1,
    comparatif: 'brokers',
    date: new Date().toISOString(),
    duree_s: Math.round((Date.now() - startedAt) / 1000),
    environnement: environment(),
    technos: [
      { id: 'kafka', nom: 'Kafka', version: '3.9.0' },
      { id: 'rabbitmq', nom: 'RabbitMQ', version: '4.0.5' },
    ],
    mesures: [/* … */],
    scenarios: [/* … */],
    erreurs: [],
  },
  { official: args.official },
);
```

`measure(fn, args)` fonctionne directement : `parseArgs()` fournit déjà `repetitions` et `warmup`.

## Tests

```bash
npm test -w packages/bench-kit
```
