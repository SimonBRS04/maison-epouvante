# Bancs de test — contrat d'exécution

Le bouton « Lancer » du dashboard exécute **une seule commande** par comparatif. Chaque banc doit donc tout faire seul.

```
Bouton « Lancer »  →  POST /api/run/<comparatif>  →  npm run bench:<comparatif> -- --officiel
                                                     │
                       ETAPE=… (progression)  ◀──────┤
                       results/<comparatif>/….json ◀─┤
                       RESULTAT=<chemin>, code 0/1/2 ◀┘
```

## Les 6 règles

1. **Point d'entrée unique** : `bench/<comparatif>/index.js`, lancé par `npm run bench:<comparatif>` depuis la racine (déjà déclaré dans le `package.json` racine). Ne change pas ce chemin.
2. **Autonome** : le banc démarre lui-même ses conteneurs (`docker compose -f infra/<comparatif>/compose.yml up -d`) et les arrête à la fin, **même en cas d'erreur** (`try … finally`). Seuls prérequis : Docker Desktop lancé et `.env` rempli.
3. **Progression** : une ligne `ETAPE=<texte court>` à chaque étape, avec `step()` de `@maison-epouvante/bench-kit`.
4. **Résultat** : écrit avec `writeResult()` de `bench-kit`, qui valide le JSON, l'écrit dans `results/` (`--officiel`) ou `results-dev/`, puis affiche `RESULTAT=<chemin>`.
5. **Codes de sortie** : `0` tout va bien · `1` le banc a planté · `2` JSON invalide.
6. **Options** : `--officiel` (résultat versionné), `--rapide` (1 répétition, développement). Pour `cicd` seulement : `--collecte-seule` (relit les derniers pipelines sans les relancer ; c'est le mode utilisé par le bouton).

## Tester sans le dashboard

```bash
npm run bench:brokers -- --rapide
```

La dernière ligne doit être `RESULTAT=…` et `npm run validate:results` doit passer.

Détail complet : [`docs/socle-commun.md`](../docs/socle-commun.md), §7 et §8.
