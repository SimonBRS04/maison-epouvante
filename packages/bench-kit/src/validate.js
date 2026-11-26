import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { SCHEMA_PATH } from './paths.js';

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateShape = ajv.compile(schema);

/**
 * Validates a benchmark result against the contract v1.
 *
 * Two layers:
 *   1. results/schema.json checks the shape of every field;
 *   2. checkConsistency() checks the rules a JSON Schema cannot express across
 *      fields (values keyed by the run's own technos, min <= median <= max…).
 * Layer 2 only runs once layer 1 passes, so its code can trust the shape.
 *
 * @param {unknown} result
 * @returns {{ valid: boolean, errors: string[] }} Errors are readable one-liners.
 */
export function validateResult(result) {
  if (!validateShape(result)) {
    return { valid: false, errors: validateShape.errors.map(formatAjvError) };
  }
  const errors = checkConsistency(result);
  return { valid: errors.length === 0, errors };
}

function formatAjvError({ instancePath, message, params }) {
  const where = instancePath || '(root)';
  const detail = params?.allowedValues ? ` (${params.allowedValues.join(', ')})` : '';
  return `${where}: ${message}${detail}`;
}

function checkConsistency(result) {
  const errors = [];
  const technoIds = result.technos.map((techno) => techno.id);

  if (new Set(technoIds).size !== technoIds.length) {
    errors.push('/technos: the two technos must be different');
  }

  const seenIds = new Set();
  const checkUniqueId = (id, where) => {
    if (seenIds.has(id)) errors.push(`${where}: id "${id}" is used more than once`);
    seenIds.add(id);
  };

  result.mesures.forEach((measure, index) => {
    const where = `/mesures/${index}`;
    checkUniqueId(measure.id, where);
    checkKeyedByTechnos(measure.valeurs, technoIds, `${where}/valeurs`, errors);

    const hasNull = Object.values(measure.valeurs).some((value) => value === null);
    if (hasNull && !measure.note) {
      errors.push(`${where}: a null value needs a "note" explaining why`);
    }

    for (const [technoId, value] of Object.entries(measure.valeurs)) {
      if (value && !(value.min <= value.mediane && value.mediane <= value.max)) {
        errors.push(`${where}/valeurs/${technoId}: expected min <= mediane <= max`);
      }
    }
  });

  result.scenarios.forEach((scenario, index) => {
    const where = `/scenarios/${index}`;
    checkUniqueId(scenario.id, where);
    checkKeyedByTechnos(scenario.resultats, technoIds, `${where}/resultats`, errors);
  });

  return errors;
}

/** Each measure and scenario must report exactly the two technos of the run. */
function checkKeyedByTechnos(record, technoIds, where, errors) {
  const keys = Object.keys(record);
  const missing = technoIds.filter((id) => !keys.includes(id));
  const unexpected = keys.filter((key) => !technoIds.includes(key));
  if (missing.length > 0) errors.push(`${where}: missing techno(s) ${missing.join(', ')}`);
  if (unexpected.length > 0) {
    errors.push(`${where}: techno(s) not part of this run: ${unexpected.join(', ')}`);
  }
}
