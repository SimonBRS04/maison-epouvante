import { describe, expect, it, vi } from 'vitest';
import { measure, median, percentile } from '../src/stats.js';

describe('median', () => {
  it('returns the middle value of an odd list, whatever the order', () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it('averages the two middle values of an even list', () => {
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });

  it("does not reorder the caller's array", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });

  it('rejects an empty list or non-numeric values', () => {
    expect(() => median([])).toThrow(TypeError);
    expect(() => median([1, Number.NaN])).toThrow(TypeError);
  });
});

describe('percentile (nearest rank)', () => {
  const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1);

  it('returns the expected rank on 1..100', () => {
    expect(percentile(oneToHundred, 95)).toBe(95);
    expect(percentile(oneToHundred, 50)).toBe(50);
    expect(percentile(oneToHundred, 100)).toBe(100);
  });

  it('always returns a measured value on small samples', () => {
    expect(percentile([10, 20, 30], 95)).toBe(30);
    expect(percentile([10, 20, 30], 34)).toBe(20);
  });

  it('rejects p outside ]0, 100]', () => {
    expect(() => percentile([1], 0)).toThrow(RangeError);
    expect(() => percentile([1], 101)).toThrow(RangeError);
  });
});

describe('measure', () => {
  it('discards warm-up runs and summarises the others', async () => {
    const samples = [1000, 30, 10, 20];
    const fn = vi.fn(() => samples.shift());

    const result = await measure(fn, { repetitions: 3, warmup: 1 });

    expect(fn).toHaveBeenCalledTimes(4);
    expect(result).toEqual({ mediane: 20, min: 10, max: 30 });
  });

  it('awaits asynchronous measurements', async () => {
    const result = await measure(async () => 42, { repetitions: 2, warmup: 0 });
    expect(result).toEqual({ mediane: 42, min: 42, max: 42 });
  });

  it('rejects an invalid number of repetitions', async () => {
    await expect(measure(() => 1, { repetitions: 0 })).rejects.toThrow(RangeError);
  });
});
