// Users in MongoDB when MONGO_URI is set, otherwise in data/users.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'users.json');
let User = null;

export async function initUsers() {
  if (!process.env.MONGO_URI) return;
  User = (await import('../models/User.js')).default;
}

const read = () => {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
};
const write = users => fs.writeFileSync(FILE, JSON.stringify(users, null, 1));
const fromDoc = d => (d ? { id: String(d._id), username: d.username, displayName: d.displayName, passwordHash: d.passwordHash, createdAt: d.createdAt } : null);

export async function findUserByUsername(username) {
  const u = username.toLowerCase();
  if (User) return fromDoc(await User.findOne({ username: u }).lean());
  return read().find(x => x.username === u) || null;
}

export async function findUserById(id) {
  if (!id) return null;
  if (User) {
    try {
      return fromDoc(await User.findById(id).lean());
    } catch {
      return null;
    }
  }
  return read().find(x => x.id === id) || null;
}

export async function createUser({ username, displayName, passwordHash }) {
  const doc = { username: username.toLowerCase(), displayName, passwordHash };
  if (User) return fromDoc((await User.create(doc)).toObject());
  const users = read();
  if (users.some(x => x.username === doc.username)) {
    const err = new Error('taken');
    err.code = 11000;
    throw err;
  }
  const user = { id: crypto.randomUUID(), ...doc, createdAt: new Date().toISOString() };
  users.push(user);
  write(users);
  return user;
}
