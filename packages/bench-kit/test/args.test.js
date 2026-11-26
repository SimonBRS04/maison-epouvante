import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/args.js';

describe('parseArgs', () => {
  it('defaults to a development run with 5 repetitions and 1 warm-up', () => {
    expect(parseArgs([])).toEqual({
      official: false,
      quick: false,
      collectOnly: false,
      repetitions: 5,
      warmup: 1,
    });
  });

  it('reads --officiel and --collecte-seule', () => {
    const args = parseArgs(['--officiel', '--collecte-seule']);
    expect(args.official).toBe(true);
    expect(args.collectOnly).toBe(true);
  });

  it('--rapide means 1 repetition and no warm-up', () => {
    expect(parseArgs(['--rapide'])).toMatchObject({ quick: true, repetitions: 1, warmup: 0 });
  });

  it('--repetitions overrides the default, even with --rapide', () => {
    expect(parseArgs(['--rapide', '--repetitions', '3']).repetitions).toBe(3);
  });

  it('rejects an invalid repetition count', () => {
    expect(() => parseArgs(['--repetitions', 'abc'])).toThrow(TypeError);
  });

  it('rejects unknown options, so typos are never silently ignored', () => {
    expect(() => parseArgs(['--oficiel'])).toThrow();
  });
});
