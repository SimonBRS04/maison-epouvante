/**
 * Announces a benchmark step. The dashboard reads stdout line by line and shows
 * every `ETAPE=` line as live progress, so the text must stay on a single line.
 *
 * @param {string} text Short, human-readable description (French, like the UI).
 */
export function step(text) {
  const singleLine = String(text).replace(/\s+/g, ' ').trim();
  console.log(`ETAPE=${singleLine}`);
}
