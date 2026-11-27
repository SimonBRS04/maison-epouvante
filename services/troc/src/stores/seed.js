import { readFileSync } from 'node:fs';

/** Starting offers, shared by both stores. */
export function loadSeed() {
  return JSON.parse(readFileSync(new URL('../../data/offers.json', import.meta.url), 'utf8'));
}

/** Numeric part of an id such as "o-0007", used to keep generated ids increasing. */
export function idNumber(id) {
  return Number(id.split('-')[1]) || 0;
}

export function formatId(number) {
  return `o-${String(number).padStart(4, '0')}`;
}
