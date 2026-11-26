/**
 * Statistics shared by the three benchmarks, so that every p95 and every median
 * in the dashboard is computed the same way.
 */

/**
 * Median of a list of numbers (mean of the two middle values for an even count).
 * @param {number[]} values
 */
export function median(values) {
  const sorted = sortedCopy(values);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Percentile using the nearest-rank method: the smallest value such that at least
 * p % of the values are less than or equal to it. Always returns a measured value
 * (no interpolation), which keeps p95 latencies honest on small samples.
 *
 * @param {number[]} values
 * @param {number} p Percentile in ]0, 100].
 */
export function percentile(values, p) {
  if (!(p > 0 && p <= 100)) {
    throw new RangeError(`percentile expects p in ]0, 100], received ${p}.`);
  }
  const sorted = sortedCopy(values);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[rank - 1];
}

/**
 * Runs a measurement several times and summarises it in the contract format.
 * Warm-up runs are executed but discarded: the first run of a JVM, a container
 * or a connection pool is rarely representative.
 *
 * @param {() => number | Promise<number>} fn One measurement, returning a number.
 * @param {{ repetitions?: number, warmup?: number }} [options] Usually spread from parseArgs().
 * @returns {Promise<{ mediane: number, min: number, max: number }>}
 */
export async function measure(fn, { repetitions = 5, warmup = 1 } = {}) {
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new RangeError(`repetitions must be a positive integer, received ${repetitions}.`);
  }

  for (let i = 0; i < warmup; i += 1) {
    await fn();
  }

  const samples = [];
  for (let i = 0; i < repetitions; i += 1) {
    samples.push(await fn());
  }

  return { mediane: median(samples), min: Math.min(...samples), max: Math.max(...samples) };
}

function sortedCopy(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError('Expected a non-empty array of numbers.');
  }
  if (!values.every(Number.isFinite)) {
    throw new TypeError('Every value must be a finite number.');
  }
  return [...values].sort((a, b) => a - b);
}
