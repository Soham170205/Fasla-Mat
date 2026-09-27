// Saved deals in MongoDB when MONGO_URI is set, otherwise data/leaderboard.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'leaderboard.json');
let Score = null;

export async function initLeaderboard() {
  if (!process.env.MONGO_URI) {
    console.log('Storage: JSON files in server/data (set MONGO_URI to use MongoDB)');
    return;
  }
  const mongoose = (await import('mongoose')).default;
  await mongoose.connect(process.env.MONGO_URI);
  Score = (await import('../models/Score.js')).default;
  console.log('Storage: MongoDB connected');
}

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function all() {
  return Score ? Score.find().lean() : readFile();
}

const dealView = ({ name, userId, vendorId, vendorName, item, openingPrice, finalPrice, savingsPct, turns, score, createdAt }) => ({
  name, userId, vendorId, vendorName, item, openingPrice, finalPrice, savingsPct, turns, score, createdAt
});

export async function hasEntry(sessionId) {
  if (Score) return Boolean(await Score.exists({ sessionId }));
  return readFile().some(e => e.sessionId === sessionId);
}

export async function addEntry(entry) {
  if (Score) return (await Score.create(entry)).toObject();
  const rows = readFile();
  const row = { ...entry, createdAt: new Date().toISOString() };
  rows.push(row);
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 1));
  return row;
}

// Best single deals
export async function topDeals(limit = 10) {
  const rows = Score ? await Score.find().sort({ score: -1, createdAt: 1 }).limit(limit).lean() : readFile().sort((a, b) => b.score - a.score).slice(0, limit);
  return rows.map(dealView);
}

// Player ranking: sum of each player's best score per vendor, so replaying one stall can't farm points
export async function topPlayers(limit = 10) {
  const byUser = new Map();
  for (const r of await all()) {
    const u = byUser.get(r.userId) || { userId: r.userId, name: r.name, best: {}, deals: 0 };
    u.deals++;
    u.name = r.name;
    u.best[r.vendorId] = Math.max(u.best[r.vendorId] || 0, r.score);
    byUser.set(r.userId, u);
  }
  return [...byUser.values()]
    .map(u => ({ userId: u.userId, name: u.name, deals: u.deals, stalls: Object.keys(u.best).length, total: Object.values(u.best).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export async function userSummary(userId) {
  const mine = (await all()).filter(r => r.userId === userId).sort((a, b) => b.score - a.score);
  const players = await topPlayers(100000);
  const idx = players.findIndex(p => p.userId === userId);
  return {
    rank: idx >= 0 ? idx + 1 : null,
    total: idx >= 0 ? players[idx].total : 0,
    deals: mine.length,
    best: mine.slice(0, 10).map(dealView)
  };
}
