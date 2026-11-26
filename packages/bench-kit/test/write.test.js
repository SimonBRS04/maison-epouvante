import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT_INVALID_RESULT, writeResult } from '../src/write.js';
import { buildResult } from './helpers.js';

let rootDir;

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), 'bench-kit-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await rm(rootDir, { recursive: true, force: true });
});

describe('writeResult', () => {
  it('writes a development run to results-dev/ with a Windows-safe name', async () => {
    const { valid, path: filePath } = await writeResult(buildResult(), { rootDir });

    expect(valid).toBe(true);
    expect(filePath).toBe(
      path.join(rootDir, 'results-dev', 'brokers', '2026-12-01T14-30-00Z.json'),
    );
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual(buildResult());
  });

  it('writes an official run to results/', async () => {
    const { path: filePath } = await writeResult(buildResult(), { rootDir, official: true });
    expect(filePath.startsWith(path.join(rootDir, 'results', 'brokers'))).toBe(true);
  });

  it('prints RESULTAT=<path> for the dashboard', async () => {
    const { path: filePath } = await writeResult(buildResult(), { rootDir });
    expect(console.log).toHaveBeenLastCalledWith(`RESULTAT=${filePath}`);
  });

  it('leaves no temporary file behind', async () => {
    await writeResult(buildResult(), { rootDir });
    const files = await readdir(path.join(rootDir, 'results-dev', 'brokers'));
    expect(files.some((name) => name.endsWith('.tmp'))).toBe(false);
  });

  it('never overwrites a run from the same second', async () => {
    const first = await writeResult(buildResult(), { rootDir });
    const second = await writeResult(buildResult(), { rootDir });
    expect(second.path).not.toBe(first.path);
    expect(second.path.endsWith('-2.json')).toBe(true);
  });

  it('moves an invalid result to rejets/ and sets exit code 2', async () => {
    const result = buildResult();
    result.scenarios[0].resultats.kafka.statut = 'FAIL';

    const { valid, path: filePath, errors } = await writeResult(result, { rootDir });

    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
    expect(path.dirname(filePath)).toBe(path.join(rootDir, 'results-dev', 'brokers', 'rejets'));
    expect(process.exitCode).toBe(EXIT_INVALID_RESULT);
    expect(console.log).not.toHaveBeenCalled();
  });
});
