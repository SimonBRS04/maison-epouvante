import { afterEach, describe, expect, it, vi } from 'vitest';
import { step } from '../src/progress.js';

afterEach(() => vi.restoreAllMocks());

describe('step', () => {
  it('prints a single ETAPE= line', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    step('Démarrage de Kafka');
    expect(log).toHaveBeenCalledWith('ETAPE=Démarrage de Kafka');
  });

  it('flattens line breaks so the dashboard never receives a partial line', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    step('Mesure\nde la latence  ');
    expect(log).toHaveBeenCalledWith('ETAPE=Mesure de la latence');
  });
});
