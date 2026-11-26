import { describe, expect, it } from 'vitest';
import { validateResult } from '../src/validate.js';
import { buildResult } from './helpers.js';

/** Applies a mutation to a fresh valid result and validates it. */
function validateWith(mutate) {
  const result = buildResult();
  mutate(result);
  return validateResult(result);
}

describe('validateResult — valid results', () => {
  it('accepts the reference result', () => {
    expect(validateResult(buildResult())).toEqual({ valid: true, errors: [] });
  });

  it('accepts a null value when the measure explains it in a note', () => {
    const { valid } = validateWith((r) => {
      r.mesures[0].valeurs.kafka = null;
      r.mesures[0].note = 'Service en ligne : non mesurable';
    });
    expect(valid).toBe(true);
  });

  it('accepts a result without any measure or scenario yet', () => {
    expect(
      validateWith((r) => {
        r.mesures = [];
        r.scenarios = [];
      }).valid,
    ).toBe(true);
  });
});

describe('validateResult — shape (JSON Schema)', () => {
  const invalidCases = [
    ['an unknown comparison', (r) => (r.comparatif = 'databases')],
    ['a date that is not ISO 8601', (r) => (r.date = '01/12/2026')],
    ['an unknown field', (r) => (r.commentaire = 'oops')],
    ['a missing environment field', (r) => delete r.environnement.commit],
    ['a single techno', (r) => r.technos.pop()],
    ['a techno from another comparison', (r) => (r.technos[0].id = 'keycloak')],
    ['an id that is not snake_case', (r) => (r.mesures[0].id = 'latenceP95')],
    ['an unknown category', (r) => (r.mesures[0].categorie = 'Vitesse')],
    ['an unknown unit', (r) => (r.mesures[0].unite = 'minutes')],
    ['zero repetitions', (r) => (r.mesures[0].repetitions = 0)],
    ['an unknown status', (r) => (r.scenarios[0].resultats.kafka.statut = 'FAIL')],
    [
      'a finding longer than 120 characters',
      (r) => (r.scenarios[0].resultats.kafka.constat = 'x'.repeat(121)),
    ],
    ['a scenario value without its unit', (r) => delete r.scenarios[0].resultats.rabbitmq.unite],
  ];

  it.each(invalidCases)('rejects %s', (_label, mutate) => {
    const { valid, errors } = validateWith(mutate);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns readable error messages with the faulty path', () => {
    const { errors } = validateWith((r) => (r.mesures[0].unite = 'minutes'));
    expect(errors.some((e) => e.startsWith('/mesures/0/unite:'))).toBe(true);
  });
});

describe('validateResult — consistency rules', () => {
  it('rejects the same techno twice', () => {
    const { errors } = validateWith((r) => (r.technos[1] = { ...r.technos[0] }));
    expect(errors).toContain('/technos: the two technos must be different');
  });

  it('rejects a measure missing one of the two technos', () => {
    const { errors } = validateWith((r) => {
      delete r.mesures[0].valeurs.rabbitmq;
      r.mesures[0].valeurs.teamcity = { mediane: 1, min: 1, max: 1 };
    });
    expect(errors).toContain('/mesures/0/valeurs: missing techno(s) rabbitmq');
    expect(errors).toContain('/mesures/0/valeurs: techno(s) not part of this run: teamcity');
  });

  it('rejects a null value without a note', () => {
    const { errors } = validateWith((r) => (r.mesures[0].valeurs.kafka = null));
    expect(errors).toContain('/mesures/0: a null value needs a "note" explaining why');
  });

  it('rejects a median outside [min, max]', () => {
    const { errors } = validateWith((r) => (r.mesures[0].valeurs.kafka.mediane = 99));
    expect(errors).toContain('/mesures/0/valeurs/kafka: expected min <= mediane <= max');
  });

  it('rejects an id used twice', () => {
    const { errors } = validateWith((r) => (r.scenarios[0].id = 'latence_p95'));
    expect(errors).toContain('/scenarios/0: id "latence_p95" is used more than once');
  });
});
