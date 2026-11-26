#!/usr/bin/env node
/**
 * Creates and configures the team repository on the account of the logged-in user
 * (run ONCE, from the project root).
 *
 * Prerequisites:
 *   1. `gh auth login` done;
 *   2. the folder is a git repository with at least one commit on main.
 *
 * Usage:
 *   node scripts/github/setup.mjs --dry-run      print the commands without running them
 *   node scripts/github/setup.mjs                run
 *   node scripts/github/setup.mjs --collaborateurs login1,login2,login3
 *                                                invite the members (full access to the repository)
 *
 * Option: --repo <name> (default maison-epouvante).
 * Safe to re-run: each step checks whether it is already done.
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

/** Runs a command; in --dry-run mode, only prints it. */
function run(command, commandArgs, { allowFailure = false, quiet = false } = {}) {
  const printable = [command, ...commandArgs].join(' ');
  if (DRY_RUN) {
    console.log(`  [dry run] ${printable}`);
    return '';
  }
  try {
    return execFileSync(command, commandArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    console.error(`\n✗ Failed: ${printable}\n${error.stderr ?? error.message}`);
    process.exit(1);
  }
}

/** True when the command succeeds (used to check whether a resource exists). */
function succeeds(command, commandArgs) {
  if (DRY_RUN) return false;
  return run(command, commandArgs, { allowFailure: true, quiet: true }) !== null;
}

function step(title) {
  console.log(`\n▶ ${title}`);
}

// ---------------------------------------------------------------------------

step('Checking the GitHub login');
run('gh', ['auth', 'status']);
const me = DRY_RUN ? '<toi>' : run('gh', ['api', 'user', '--jq', '.login']);
const REPO = `${me}/${args.repo}`;
console.log(`  logged in as ${me}`);

step(`Repository ${REPO}`);
if (succeeds('gh', ['repo', 'view', REPO])) {
  console.log('  already exists: pushing main');
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

step('Repository settings (squash only, merged branches deleted)');
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

step('Security: secret scanning, push protection, dependency alerts');
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

step('Labels');
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

step('Protection of the main branch');
run('gh', [
  'api',
  '-X',
  'PUT',
  `repos/${REPO}/branches/main/protection`,
  '--input',
  PROTECTION_FILE,
]);
console.log('  pull request required, 1 approval, green "qualite" check, linear history');

if (args.collaborateurs) {
  step('Inviting collaborators (full access to the repository)');
  const logins = args.collaborateurs
    .split(',')
    .map((login) => login.trim())
    .filter(Boolean);
  for (const login of logins) {
    run('gh', ['api', '-X', 'PUT', `repos/${REPO}/collaborators/${login}`]);
    console.log(`  ${login} invited (invitation sent by e-mail, to be accepted)`);
  }
}

console.log(`\n✓ Done: https://github.com/${REPO}\n`);
