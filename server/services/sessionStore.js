import crypto from 'node:crypto';

// In-memory sessions: fast to build, lost on restart (fine for a demo)
const sessions = new Map();
const TTL_MS = 60 * 60 * 1000;

export function createSession(data) {
  const now = Date.now();
  const session = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...data };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id) {
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() - s.updatedAt > TTL_MS) {
    sessions.delete(id);
    return null;
  }
  return s;
}

export function saveSession(s) {
  s.updatedAt = Date.now();
  sessions.set(s.id, s);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.updatedAt > TTL_MS) sessions.delete(id);
}, 10 * 60 * 1000).unref();
