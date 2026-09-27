// The LLM plays the character; this file owns the numbers.
export const MOODS = ['happy', 'neutral', 'annoyed', 'angry'];

const toInt = x => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Validate one shopkeeper turn and apply it to the session.
 * out: { reply, newPrice, mood, patienceDelta, dealAccepted, playerOffer }
 */
export function applyTurn(session, out) {
  let reply = typeof out.reply === 'string' && out.reply.trim() ? out.reply.trim().slice(0, 400) : 'Haan bolo, kitne mein chahiye?';
  let mood = MOODS.includes(out.mood) ? out.mood : 'neutral';

  let newPrice = toInt(out.newPrice) ?? session.currentPrice;
  newPrice = Math.max(newPrice, session.floorPrice);   // never below the secret floor
  newPrice = Math.min(newPrice, session.currentPrice); // never goes back up

  const delta = clamp(toInt(out.patienceDelta) ?? -8, -35, 10);

  if (out.dealAccepted === true) {
    const offer = toInt(out.playerOffer);
    const price = Math.min(offer ?? newPrice, session.currentPrice);
    if (session.turns >= 2 && price >= session.floorPrice) {
      session.status = 'deal';
      session.finalPrice = price;
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
      reply += ' Bas! Chalo niklo yahan se, time khoti mat karo.';
    }
  }

  return { reply, mood: session.mood };
}
