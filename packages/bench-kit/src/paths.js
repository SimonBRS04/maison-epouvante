import { fileURLToPath } from 'node:url';

/** Absolute path of the repository root (bench-kit lives in packages/bench-kit/src). */
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Absolute path of the result contract. */
export const SCHEMA_PATH = fileURLToPath(new URL('../../../results/schema.json', import.meta.url));
