import { parseArgs as parseNodeArgs } from 'node:util';

const DEFAULT_REPETITIONS = 5;

/**
 * Reads the options shared by every benchmark (see bench/README.md).
 *
 *   --officiel        write to results/ (versioned) instead of results-dev/
 *   --rapide          development mode: 1 repetition, no warm-up
 *   --collecte-seule  cicd only: read the last pipeline runs instead of triggering new ones
 *   --repetitions <n> override the default number of repetitions (5)
 *
 * Unknown options throw, so a typo never silently falls back to a default.
 *
 * @param {string[]} [argv] Defaults to the current process arguments.
 * @returns {{ official: boolean, quick: boolean, collectOnly: boolean, repetitions: number, warmup: number }}
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      officiel: { type: 'boolean', default: false },
      rapide: { type: 'boolean', default: false },
      'collecte-seule': { type: 'boolean', default: false },
      repetitions: { type: 'string' },
    },
  });

  const quick = values.rapide;
  const repetitions =
    values.repetitions === undefined
      ? quick
        ? 1
        : DEFAULT_REPETITIONS
      : parsePositiveInteger(values.repetitions);

  return {
    official: values.officiel,
    quick,
    collectOnly: values['collecte-seule'],
    repetitions,
    warmup: quick ? 0 : 1,
  };
}

function parsePositiveInteger(raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`--repetitions expects a positive integer, received "${raw}".`);
  }
  return value;
}
