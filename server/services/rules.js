// The LLM plays the character; this file owns the numbers.
export const MOODS = ['happy', 'neutral', 'annoyed', 'angry'];

const toInt = x => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Replace a price the model wrote ("₹467" or "467") with the price the rules settled on
function syncPrice(text, from, to) {
  if (from === to) return text;
  return text.replace(new RegExp(`(₹\\s?)?(?<!\\d)${from}(?!\\d)`, 'g'), `₹${to}`);
}
/**
 * Validate one shopkeeper turn and apply it to the session.
 * out: { reply, newPrice, mood, patienceDelta, dealAccepted, playerOffer }
 */
export function applyTurn(session, out) {
  let reply = typeof out.reply === 'string' && out.reply.trim() ? out.reply.trim().slice(0, 400) : 'Haan bolo, kitne mein chahiye?';
  let mood = MOODS.includes(out.mood) ? out.mood : 'neutral';

  const asked = toInt(out.newPrice);
  let newPrice = asked ?? session.currentPrice;
  newPrice = Math.max(newPrice, session.floorPrice);   // never below the secret floor
  newPrice = Math.min(newPrice, session.currentPrice); // never goes back up
  // if we corrected the number, correct it in what the shopkeeper says too
  if (asked !== null) reply = syncPrice(reply, asked, newPrice);

  const delta = clamp(toInt(out.patienceDelta) ?? -8, -35, 10);

  if (out.dealAccepted === true) {
    const offer = toInt(out.playerOffer);
    const price = Math.min(offer ?? newPrice, session.currentPrice);
    if (price >= session.floorPrice) {
      session.status = 'deal';
      session.finalPrice = price;
      if (offer !== null) reply = syncPrice(reply, offer, price);
      newPrice = price;
      mood = 'happy';
    } else {
      reply = `Arre nahi nahi, itne mein toh mera nuksaan ho jayega! ₹${newPrice} se kam nahi.`;
      mood = 'annoyed';
    }
  }

  session.currentPrice = newPrice;
  session.mood = mood;

  if (session.status === 'playing') {
    session.patience = clamp(session.patience + delta, 0, 100);
    if (session.patience <= 0) {
      session.status = 'kicked_out';
      session.mood = 'angry';
    }
  }

  return { reply, mood: session.mood };
}
