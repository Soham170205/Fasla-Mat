// Password hashing (scrypt) and signed session tokens (HMAC-SHA256). No extra dependencies.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUserById } from './userStore.js';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const TOKEN_TTL_S = 7 * 24 * 3600;

// Use AUTH_SECRET in production. Locally a random secret is created once and kept in data/.auth_secret
function loadSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const file = path.join(DATA, '.auth_secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, secret);
    console.warn('AUTH_SECRET not set: generated one in server/data/.auth_secret');
    return secret;
  }
}
const SECRET = loadSecret();

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const sign = data => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function createToken(user) {
  const payload = b64({ sub: user.id, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S });
  return `${payload}.${sign(payload)}`;
}

export function readToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

async function userFromReq(req) {
  const header = req.get('authorization') || '';
  const data = readToken(header.startsWith('Bearer ') ? header.slice(7) : null);
  return data ? findUserById(data.sub) : null;
}

// Attaches req.user when a valid token is sent; guests continue as guests
export async function optionalAuth(req, res, next) {
  try {
    req.user = await userFromReq(req);
    next();
  } catch (e) {
    next(e);
  }
}

export async function requireAuth(req, res, next) {
  try {
    req.user = await userFromReq(req);
    if (!req.user) return res.status(401).json({ error: 'Log in to do this.' });
    next();
  } catch (e) {
    next(e);
  }
}

export const publicUser = u => (u ? { id: u.id, username: u.username, displayName: u.displayName, createdAt: u.createdAt } : null);
