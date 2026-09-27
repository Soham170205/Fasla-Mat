import { Router } from 'express';
import { getSession } from '../services/sessionStore.js';
import { findVendor } from '../data/items.js';
import { addEntry, hasEntry, topEntries } from '../services/leaderboardStore.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({ entries: await topEntries(10) });
  } catch (e) {
    next(e);
  }
});

// Scores come from the server-side session, never from the client
router.post('/', async (req, res, next) => {
  try {
    const { sessionId, name } = req.body || {};
    const s = getSession(sessionId);
    if (!s || s.status !== 'deal') return res.status(400).json({ error: 'Only finished deals can go on the leaderboard.' });
    if (await hasEntry(s.id)) return res.status(409).json({ error: 'This deal is already on the leaderboard.' });
    const clean = String(name || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 20) || 'Anonymous';
    const v = findVendor(s.vendorId);
    await addEntry({
      sessionId: s.id,
      name: clean,
      vendorId: v.id,
      vendorName: v.name,
      item: v.item.name,
      openingPrice: s.openingPrice,
      finalPrice: s.finalPrice,
      savingsPct: s.savingsPct,
      turns: s.turns,
      score: s.score
    });
    res.json({ entries: await topEntries(10) });
  } catch (e) {
    next(e);
  }
});

export default router;
