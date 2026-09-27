// MongoDB when MONGO_URI is set, otherwise a JSON file next to the server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'leaderboard.json');
let Score = null;

export async function initLeaderboard() {
  if (!process.env.MONGO_URI) {
    console.log('Leaderboard: JSON file (set MONGO_URI to use MongoDB)');
    return;
  }
  const mongoose = (await import('mongoose')).default;
  await mongoose.connect(process.env.MONGO_URI);
  Score = (await import('../models/Score.js')).default;
  console.log('Leaderboard: MongoDB connected');
}

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

export async function hasEntry(sessionId) {
  if (Score) return Boolean(await Score.exists({ sessionId }));
  return readFile().some(e => e.sessionId === sessionId);
}

export async function addEntry(entry) {
  if (Score) return (await Score.create(entry)).toObject();
  const all = readFile();
  const row = { ...entry, createdAt: new Date().toISOString() };
  all.push(row);
  all.sort((a, b) => b.score - a.score);
  fs.writeFileSync(FILE, JSON.stringify(all.slice(0, 500), null, 1));
  return row;
}

export async function topEntries(limit = 10) {
  const rows = Score ? await Score.find().sort({ score: -1, createdAt: 1 }).limit(limit).lean() : readFile().slice(0, limit);
  return rows.map(({ name, vendorName, item, openingPrice, finalPrice, savingsPct, score, createdAt }) => ({
    name, vendorName, item, openingPrice, finalPrice, savingsPct, score, createdAt
  }));
}
