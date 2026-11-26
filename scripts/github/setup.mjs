#!/usr/bin/env node
/**
 * Crée et règle le dépôt GitHub de l'équipe sur le compte de la personne connectée
 * (à lancer UNE fois, depuis la racine du projet).
 *
 * Prérequis :
 *   1. `gh auth login` fait ;
 *   2. le dossier est un dépôt git avec au moins un commit sur main.
 *
 * Usage :
 *   node scripts/github/setup.mjs --dry-run      affiche les commandes sans rien faire
 *   node scripts/github/setup.mjs                exécute
 *   node scripts/github/setup.mjs --collaborateurs pseudo1,pseudo2,pseudo3
 *                                                invite les membres (accès complet au dépôt)
 *
 * Option : --repo <nom> (défaut maison-epouvante).
 * Relançable sans risque : chaque étape vérifie si elle est déjà faite.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    repo: { type: 'string', default: 'maison-epouvante' },
    collaborateurs: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const DRY_RUN = args['dry-run'];
const PROTECTION_FILE = fileURLToPath(new URL('./branch-protection.json', import.meta.url));

const LABELS = [
  ['lot-1', '1d76db', 'Lot 1 — Dashboard'],
  ['lot-2', '0e8a16', 'Lot 2 — CI/CD + Troc'],
  ['lot-3', 'fbca04', 'Lot 3 — SSO + Catalogue'],
  ['lot-4', '5319e7', 'Lot 4 — Brokers + Notifications'],
  ['contrat', 'd93f0b', 'Touche au format des résultats ou au socle commun'],
  ['bloquant', 'b60205', 'Empêche un autre lot d’avancer'],
  ['bug', 'ee0701', 'Comportement incorrect'],
  ['soutenance', 'c5def5', 'Schémas, PPT, démo'],
];

// ---------------------------------------------------------------------------

/** Lance une commande ; en mode --dry-run, l'affiche seulement. */
function run(command, commandArgs, { allowFailure = false, quiet = false } = {}) {
  const printable = [command, ...commandArgs].join(' ');
  if (DRY_RUN) {
    console.log(`  [à blanc] ${printable}`);
    return '';
  }
  try {
    return execFileSync(command, commandArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    console.error(`\n✗ Échec : ${printable}\n${error.stderr ?? error.message}`);
    process.exit(1);
  }
}

/** Vrai si la commande réussit (sert à tester l'existence d'une ressource). */
function succeeds(command, commandArgs) {
  if (DRY_RUN) return false;
  return run(command, commandArgs, { allowFailure: true, quiet: true }) !== null;
}

function step(title) {
  console.log(`\n▶ ${title}`);
}

// ---------------------------------------------------------------------------

step('Vérification de la connexion GitHub');
run('gh', ['auth', 'status']);
const me = DRY_RUN ? '<toi>' : run('gh', ['api', 'user', '--jq', '.login']);
const REPO = `${me}/${args.repo}`;
console.log(`  connecté en tant que ${me}`);

step(`Dépôt ${REPO}`);
if (succeeds('gh', ['repo', 'view', REPO])) {
  console.log('  existe déjà : publication de main');
  run('git', ['push', '-u', 'origin', 'main']);
} else {
  run('gh', [
    'repo',
    'create',
    REPO,
    '--public',
    '--source',
    '.',
    '--remote',
    'origin',
    '--push',
    '--description',
    "POC « La Petite Maison de l'Épouvante » — comparatifs CI/CD, SSO et brokers (BLOC 3)",
  ]);
}

step('Réglages du dépôt (squash uniquement, suppression des branches fusionnées)');
run('gh', [
  'repo',
  'edit',
  REPO,
  '--enable-squash-merge',
  '--enable-merge-commit=false',
  '--enable-rebase-merge=false',
  '--delete-branch-on-merge',
  '--enable-issues',
  '--enable-wiki=false',
]);
run('gh', [
  'api',
  '-X',
  'PATCH',
  `repos/${REPO}`,
  '-f',
  'squash_merge_commit_title=PR_TITLE',
  '-f',
  'squash_merge_commit_message=PR_BODY',
]);

step('Sécurité : détection des secrets, protection des push, alertes de dépendances');
run(
  'gh',
  [
    'api',
    '-X',
    'PATCH',
    `repos/${REPO}`,
    '-f',
    'security_and_analysis[secret_scanning][status]=enabled',
    '-f',
    'security_and_analysis[secret_scanning_push_protection][status]=enabled',
  ],
  { allowFailure: true },
);
run('gh', ['api', '-X', 'PUT', `repos/${REPO}/vulnerability-alerts`], { allowFailure: true });

step('Étiquettes');
for (const [name, color, description] of LABELS) {
  run('gh', [
    'label',
    'create',
    name,
    '--color',
    color,
    '--description',
    description,
    '--force',
    '-R',
    REPO,
  ]);
}

step('Protection de la branche main');
run('gh', [
  'api',
  '-X',
  'PUT',
  `repos/${REPO}/branches/main/protection`,
  '--input',
  PROTECTION_FILE,
]);
console.log('  PR obligatoire, 1 approbation, contrôle « qualite » vert, historique linéaire');

if (args.collaborateurs) {
  step('Invitation des collaborateurs (accès complet au dépôt)');
  const logins = args.collaborateurs
    .split(',')
    .map((login) => login.trim())
    .filter(Boolean);
  for (const login of logins) {
    run('gh', ['api', '-X', 'PUT', `repos/${REPO}/collaborators/${login}`]);
    console.log(`  ${login} invité (invitation à accepter, reçue par e-mail)`);
  }
}

console.log(`\n✓ Terminé : https://github.com/${REPO}\n`);
