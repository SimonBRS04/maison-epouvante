import { readFileSync } from 'node:fs';

/** Starting catalogue, shared by both stores. */
export function loadSeed() {
  return JSON.parse(readFileSync(new URL('../../data/products.json', import.meta.url), 'utf8'));
}

/** Numeric part of an id such as "p-007", used to keep generated ids increasing. */
export function idNumber(id) {
  return Number(id.split('-')[1]) || 0;
}

export function formatId(number) {
  return `p-${String(number).padStart(3, '0')}`;
}
