#!/usr/bin/env node
/**
 * Validates every benchmark result and fixture against the contract v1.
 * Used by `npm run validate:results`, locally and in both CI/CD pipelines.
 *
 * Scanned: results/<comparatif>/*.json, results-dev/<comparatif>/*.json, fixtures/*.json.
 * Skipped: rejets/ folders (already known to be invalid) and *.tmp files.
 * Exit code: 0 if everything is valid, 1 otherwise.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResult } from '@maison-epouvante/bench-kit';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const COMPARISONS = ['cicd', 'sso', 'brokers'];

const files = [
  ...(await jsonFilesIn(...COMPARISONS.map((c) => path.join(ROOT, 'results', c)))),
  ...(await jsonFilesIn(...COMPARISONS.map((c) => path.join(ROOT, 'results-dev', c)))),
  ...(await jsonFilesIn(path.join(ROOT, 'fixtures'))),
];

if (files.length === 0) {
  console.log('No result or fixture to validate yet.');
  process.exit(0);
}

let invalidCount = 0;
for (const file of files) {
  const errors = await errorsFor(file);
  const relative = path.relative(ROOT, file);
  if (errors.length === 0) {
    console.log(`✓ ${relative}`);
  } else {
    invalidCount += 1;
    console.log(`✗ ${relative}`);
    for (const error of errors) console.log(`    - ${error}`);
  }
}

console.log(`\n${files.length - invalidCount}/${files.length} valid file(s).`);
process.exitCode = invalidCount === 0 ? 0 : 1;

/** Lists the .json files directly inside the given folders (missing folders are skipped). */
async function jsonFilesIn(...dirs) {
  const found = [];
  for (const dir of dirs.filter((d) => existsSync(d))) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) found.push(path.join(dir, entry.name));
    }
  }
  return found.sort();
}

async function errorsFor(file) {
  let content;
  try {
    content = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    return [`not valid JSON: ${error.message}`];
  }
  return validateResult(content).errors;
}
