import { describe, expect, it } from 'vitest';
import { environment } from '../src/environment.js';

describe('environment', () => {
  it('describes the machine with every field required by the contract', () => {
    const env = environment();
    expect(Object.keys(env).sort()).toEqual(['commit', 'cpu', 'machine', 'os', 'ram_go']);
    expect(env.machine.length).toBeGreaterThan(0);
    expect(env.ram_go).toBeGreaterThan(0);
    expect(typeof env.commit).toBe('string');
  });
});
