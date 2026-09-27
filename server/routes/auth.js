import { Router } from 'express';
import { hashPassword, verifyPassword, createToken, requireAuth, publicUser } from '../services/auth.js';
import { createUser, findUserByUsername } from '../services/userStore.js';

const router = Router();

// Slow down password guessing: 10 attempts per IP per 10 minutes
const attempts = new Map();
function limit(req, res, next) {
  const now = Date.now();
  const recent = (attempts.get(req.ip) || []).filter(t => now - t < 10 * 60_000);
  if (recent.length >= 10) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  recent.push(now);
  attempts.set(req.ip, recent);
  next();
}

const USERNAME = /^[a-z0-9_]{3,20}$/;

router.post('/signup', limit, async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 24) || username;
    if (!USERNAME.test(username)) return res.status(400).json({ error: 'Username must be 3-20 characters: lowercase letters, numbers or _.' });
    if (password.length < 6 || password.length > 100) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const user = await createUser({ username, displayName, passwordHash: hashPassword(password) });
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'That username is taken. Try another.' });
    next(e);
  }
});

router.post('/login', limit, async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = username ? await findUserByUsername(username) : null;
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Wrong username or password.' });
    }
    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
