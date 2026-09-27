// Predefined shopkeeper lines, drawn without repeats inside one bargain.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'demo_dialogue.json');
const DIALOGUE = JSON.parse(fs.readFileSync(FILE, 'utf8'));

export function fill(text, vars = {}) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

/** Pick an unused line for this session; once a category runs dry it reshuffles, never repeating the last one. */
export function pickLine(session, vendorId, category, vars = {}) {
  const lines = DIALOGUE[vendorId]?.[category];
  if (!lines?.length) return '';
  session.usedLines ||= {};
  let used = session.usedLines[category] || [];
  if (used.length >= lines.length) used = used.slice(-1);
  const options = lines.map((_, i) => i).filter(i => !used.includes(i));
  const i = options[Math.floor(Math.random() * options.length)];
  session.usedLines[category] = [...used, i];
  return fill(lines[i], vars);
}

export function lineCount(vendorId) {
  return Object.values(DIALOGUE[vendorId] || {}).reduce((a, l) => a + (Array.isArray(l) ? l.length : 0), 0);
}
