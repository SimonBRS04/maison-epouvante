/**
 * @maison-epouvante/bench-kit — the toolkit every benchmark imports, so that the
 * three benchmarks parse options, report progress, compute statistics and write
 * their results in exactly the same way. Contract: bench/README.md.
 */
export { parseArgs } from './args.js';
export { step } from './progress.js';
export { median, percentile, measure } from './stats.js';
export { environment } from './environment.js';
export { validateResult } from './validate.js';
export { writeResult, EXIT_INVALID_RESULT } from './write.js';
