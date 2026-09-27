import { parseOffer } from '../services/offers.js';
import { Router } from 'express';
import { VENDORS, findVendor, publicVendor, vendorOfDay } from '../data/items.js';
import { createSession, getSession, saveSession } from '../services/sessionStore.js';
import { shopkeeperTurn, aiEnabled } from '../services/shopkeeperAI.js';
import { applyTurn } from '../services/rules.js';
import { computeScore, savingsPct, rating } from '../services/scoring.js';
import { pickLine, lineCount } from '../services/dialogue.js';
import { optionalAuth } from '../services/auth.js';
import { findUserById } from '../services/userStore.js';
import { saveDeal } from '../services/saveDeal.js';

const router = Router();

// Close the bargain: score it, and save it straight away for logged-in players
async function finish(s) {
  s.score = computeScore(s);
  s.savingsPct = savingsPct(s);
  if (s.status === 'deal' && s.userId) {
    const user = await findUserById(s.userId);
    if (user) s.saved = await saveDeal(s, user);
  }
}

// Only safe fields go to the browser: no floor price, no persona, no history
function view(s, extra = {}) {
  const v = findVendor(s.vendorId);
  return {
    sessionId: s.id,
    vendorId: s.vendorId,
    shopkeeper: { name: v.name, sprite: v.sprite, mood: s.mood },
    item: v.item,
    openingPrice: s.openingPrice,
    currentPrice: s.currentPrice,
    patience: s.patience,
    turns: s.turns,
    status: s.status,
    finalPrice: s.finalPrice,
    score: s.score ?? 0,
    savingsPct: s.savingsPct ?? 0,
    rating: s.status === 'playing' ? null : rating(s.score ?? 0),
    saved: Boolean(s.saved),
    ...extra
  };
}

function load(req, res) {
  const s = getSession(req.params.id);
  if (!s) {
    res.status(404).json({ error: 'This bargain has expired. Walk back to the stall to start again.' });
    return null;
  }
  return s;
}

router.get('/vendors', (req, res) => {
  res.json({
    vendors: VENDORS.map(v => ({ ...publicVendor(v), demoLines: lineCount(v.id) })),
    vendorOfDay: vendorOfDay(),
    aiEnabled: aiEnabled()
  });
});

router.post('/start', optionalAuth, (req, res) => {
  const v = findVendor(req.body?.vendorId);
  if (!v) return res.status(400).json({ error: 'Unknown vendor' });
  const s = createSession({
    vendorId: v.id,
    userId: req.user?.id || null,
    openingPrice: v.openingPrice,
    floorPrice: v.floorPrice,
    personality: v.personality,
    currentPrice: v.openingPrice,
    patience: 100,
    turns: 0,
    mood: 'neutral',
    status: 'playing',
    finalPrice: null,
    calledBack: false,
    busy: false,
    history: []
  });
  s.openingLine = pickLine(s, v.id, 'opening', { price: v.openingPrice, item: v.item.name }) || v.greeting;
  res.json(view(s, { reply: s.openingLine }));
});

router.post('/:id/message', async (req, res, next) => {
  const s = load(req, res);
  if (!s) return;
  const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 300) : '';
  if (!text) return res.status(400).json({ error: 'Type an offer or a reason first.' });
  if (s.status !== 'playing') return res.status(409).json({ error: 'This bargain is already over.' });
  if (s.busy) return res.status(409).json({ error: 'Wait for the shopkeeper to answer.' });

  s.busy = true;
  try {
    s.turns++;
    s.history.push({ role: 'user', content: text });
    let reply;
    const offer = parseOffer(text, s);
    if (offer !== null && offer >= s.currentPrice) {
      // Offering the asking price or more closes the deal at the asking price. No AI call needed.
      s.status = 'deal';
      s.finalPrice = s.currentPrice;
      s.mood = 'happy';
      reply = pickLine(s, s.vendorId, 'overpay', { offer, price: s.currentPrice });
    } else {
      const out = await shopkeeperTurn(s, findVendor(s.vendorId));
      ({ reply } = applyTurn(s, out));
      if (s.status === 'kicked_out') reply += ' ' + pickLine(s, s.vendorId, 'kickedOut');
    }
    s.history.push({
      role: 'assistant',
      content: JSON.stringify({ reply, newPrice: s.currentPrice, mood: s.mood, dealAccepted: s.status === 'deal' })
    });
    if (s.status !== 'playing') await finish(s);
    res.json(view(s, { reply }));
  } catch (e) {
    next(e);
  } finally {
    s.busy = false;
    saveSession(s);
  }
});

router.post('/:id/accept', async (req, res, next) => {
  const s = load(req, res);
  if (!s) return;
  if (s.status !== 'playing') return res.status(409).json({ error: 'This bargain is already over.' });
  try {
    s.status = 'deal';
    s.finalPrice = s.currentPrice;
    s.mood = 'happy';
    await finish(s);
    saveSession(s);
    res.json(view(s, { reply: pickLine(s, s.vendorId, 'accept', { offer: s.finalPrice, price: s.finalPrice }) }));
  } catch (e) {
    next(e);
  }
});

// Walking away: sometimes the shopkeeper calls you back with a better price (once per bargain)
router.post('/:id/walkaway', async (req, res, next) => {
  const s = load(req, res);
  if (!s) return;
  if (s.status !== 'playing') return res.status(409).json({ error: 'This bargain is already over.' });
  try {
    const canCallBack = !s.calledBack && s.patience >= 30 && s.currentPrice > s.floorPrice;
    if (canCallBack && Math.random() < 0.65) {
      s.calledBack = true;
      const drop = Math.round(s.currentPrice * (0.06 + Math.random() * 0.05));
      s.currentPrice = Math.max(s.floorPrice, s.currentPrice - drop);
      s.mood = 'neutral';
      saveSession(s);
      return res.json(view(s, { reply: pickLine(s, s.vendorId, 'callback', { price: s.currentPrice }), event: 'called_back' }));
    }
    s.status = 'walked_away';
    await finish(s);
    saveSession(s);
    res.json(view(s, { reply: pickLine(s, s.vendorId, 'walkedAway') }));
  } catch (e) {
    next(e);
  }
});

export default router;
