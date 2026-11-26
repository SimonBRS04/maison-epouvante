import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { REPO_ROOT } from './paths.js';

const BYTES_PER_GB = 1024 ** 3;

/**
 * Describes the machine running the benchmark (the `environnement` block of the
 * contract). The dashboard uses it to warn when two runs come from different
 * machines and are therefore not comparable.
 */
export function environment() {
  return {
    machine: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model.trim() || 'unknown',
    ram_go: Math.round((os.totalmem() / BYTES_PER_GB) * 10) / 10,
    commit: currentCommit(),
  };
}

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Not a git checkout (e.g. inside a container): the run stays valid, just untraceable.
    return 'unknown';
  }
}
