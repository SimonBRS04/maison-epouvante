import { existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';
import { validateResult } from './validate.js';

/** Exit code for an invalid result (see bench/README.md). */
export const EXIT_INVALID_RESULT = 2;

/**
 * Validates a benchmark result and writes it where the dashboard expects it.
 *
 * - valid   → results/<comparatif>/ (--officiel) or results-dev/<comparatif>/,
 *             then prints `RESULTAT=<path>` as the last line for the dashboard;
 * - invalid → <same folder>/rejets/, errors on stderr, process.exitCode = 2.
 *
 * Writing is atomic (temporary file, then rename): the dashboard never reads a
 * half-written file.
 *
 * @param {object} result A result following the contract v1.
 * @param {{ official?: boolean, rootDir?: string }} [options] rootDir is meant for tests.
 * @returns {Promise<{ valid: boolean, path: string, errors: string[] }>}
 */
export async function writeResult(result, { official = false, rootDir = REPO_ROOT } = {}) {
  const { valid, errors } = validateResult(result);

  const baseDir = path.join(
    rootDir,
    official ? 'results' : 'results-dev',
    comparisonFolder(result),
  );
  const targetDir = valid ? baseDir : path.join(baseDir, 'rejets');
  await mkdir(targetDir, { recursive: true });

  const filePath = availablePath(targetDir, fileStem(result.date));
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);

  if (valid) {
    console.log(`RESULTAT=${filePath}`);
  } else {
    console.error(`Invalid result, saved to ${filePath}:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = EXIT_INVALID_RESULT;
  }

  return { valid, path: filePath, errors };
}

/** Folder name for the comparison; a broken result still needs somewhere to go. */
function comparisonFolder(result) {
  const id = result?.comparatif;
  return ['cicd', 'sso', 'brokers'].includes(id) ? id : 'inconnu';
}

/**
 * File name derived from the run date: `2026-12-01T14-30-00Z`.
 * Colons are replaced because Windows forbids them in file names.
 */
function fileStem(date) {
  const parsed = new Date(date);
  const instant = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return instant
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replaceAll(':', '-');
}

/** Never overwrite an existing run: suffix the name if two runs share the same second. */
function availablePath(dir, stem) {
  let candidate = path.join(dir, `${stem}.json`);
  for (let suffix = 2; existsSync(candidate); suffix += 1) {
    candidate = path.join(dir, `${stem}-${suffix}.json`);
  }
  return candidate;
}
