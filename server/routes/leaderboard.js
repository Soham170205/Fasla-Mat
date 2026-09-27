import { Router } from 'express';
import { getSession } from '../services/sessionStore.js';
import { requireAuth } from '../services/auth.js';
import { topDeals, topPlayers, userSummary } from '../services/leaderboardStore.js';
import { saveDeal } from '../services/saveDeal.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [players, deals] = await Promise.all([topPlayers(10), topDeals(10)]);
    res.json({ players, deals });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json(await userSummary(req.user.id));
  } catch (e) {
    next(e);
  }
});

// Save a deal that was played as a guest (or before logging in). Score comes from the server session.
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const s = getSession(req.body?.sessionId);
    if (!s || s.status !== 'deal') return res.status(400).json({ error: 'Only finished deals can be saved. This one may have expired.' });
    if (s.userId && s.userId !== req.user.id) return res.status(403).json({ error: 'This deal belongs to another player.' });
    const saved = await saveDeal(s, req.user);
    if (!saved) return res.status(409).json({ error: 'This deal is already saved.' });
    res.json({ saved: true, me: await userSummary(req.user.id) });
  } catch (e) {
    next(e);
  }
});

export default router;
