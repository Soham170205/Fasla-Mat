import { Router } from 'express';
import { VENDORS, findVendor, publicVendor, vendorOfDay } from '../data/items.js';
import { createSession, getSession, saveSession } from '../services/sessionStore.js';
import { shopkeeperTurn, aiEnabled } from '../services/shopkeeperAI.js';
import { applyTurn } from '../services/rules.js';
import { computeScore, savingsPct, rating } from '../services/scoring.js';

const router = Router();

function finish(s) {
  s.score = computeScore(s);
  s.savingsPct = savingsPct(s);
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
  res.json({ vendors: VENDORS.map(publicVendor), vendorOfDay: vendorOfDay(), aiEnabled: aiEnabled() });
});

router.post('/start', (req, res) => {
  const v = findVendor(req.body?.vendorId);
  if (!v) return res.status(400).json({ error: 'Unknown vendor' });
  const s = createSession({
    vendorId: v.id,
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
  res.json(view(s, { reply: v.greeting }));
});

router.post('/:id/message', async (req, res) => {
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
    const out = await shopkeeperTurn(s, findVendor(s.vendorId));
    const { reply } = applyTurn(s, out);
    s.history.push({
      role: 'assistant',
      content: JSON.stringify({ reply, newPrice: s.currentPrice, mood: s.mood, dealAccepted: s.status === 'deal' })
    });
    if (s.status !== 'playing') finish(s);
    res.json(view(s, { reply }));
  } finally {
    s.busy = false;
    saveSession(s);
  }
});

router.post('/:id/accept', (req, res) => {
  const s = load(req, res);
  if (!s) return;
  if (s.status !== 'playing') return res.status(409).json({ error: 'This bargain is already over.' });
  s.status = 'deal';
  s.finalPrice = s.currentPrice;
  s.mood = 'happy';
  finish(s);
  saveSession(s);
  res.json(view(s, { reply: `Pakka! ₹${s.finalPrice}. Yeh lo, phir aana.` }));
});

// Walking away: sometimes the shopkeeper calls you back with a better price (once per bargain)
router.post('/:id/walkaway', (req, res) => {
  const s = load(req, res);
  if (!s) return;
  if (s.status !== 'playing') return res.status(409).json({ error: 'This bargain is already over.' });

  const canCallBack = !s.calledBack && s.patience >= 30 && s.currentPrice > s.floorPrice;
  if (canCallBack && Math.random() < 0.65) {
    s.calledBack = true;
    const drop = Math.round(s.currentPrice * (0.06 + Math.random() * 0.05));
    s.currentPrice = Math.max(s.floorPrice, s.currentPrice - drop);
    s.mood = 'neutral';
    saveSession(s);
    return res.json(view(s, { reply: `Arre ruko ruko! Chalo ₹${s.currentPrice}, bas aapke liye. Ab toh le lo!`, event: 'called_back' }));
  }
  s.status = 'walked_away';
  finish(s);
  saveSession(s);
  res.json(view(s, { reply: 'Theek hai, jao. Aisa maal poore bazaar mein nahi milega!' }));
});

export default router;
