// Works out which number in a message is the player's offer.
// "500 de do" -> 500 · "₹300, 450 bahut hai" -> 300 (₹/rs wins) · "450 se kam karo" -> null (a reference, not an offer)
// "mera number 9876543210" -> null (too long) · "5 kg" -> ignored (too small)
export function parseOffer(text, s) {
  const clean = String(text).replace(/,/g, '');
  const found = [...clean.matchAll(/(₹\s*|rs\.?\s*|inr\s*)?(?<!\d)(\d{2,6})(?!\d)/gi)].map(m => ({
    n: Number(m[2]),
    marked: Boolean(m[1])
  }));
  // only amounts that could plausibly be a price for this item
  const plausible = found.filter(x => x.n >= s.openingPrice * 0.15 && x.n <= s.openingPrice * 3);
  if (!plausible.length) return null;
  const marked = plausible.filter(x => x.marked);
  const pool = marked.length ? marked : plausible;
  const offers = pool.filter(x => x.n !== s.currentPrice && x.n !== s.openingPrice);
  if (offers.length) return offers[0].n;
  // Only the shopkeeper's own price was mentioned. "450 se kam karo" is a reference, not an offer;
  // it only counts as an offer when the player is agreeing to it ("450", "450 de do", "450 final").
  const agreeing = /^\s*(₹|rs\.?)?\s*\d+\s*$|de ?do|dunga|dungi|lunga|lungi|\bok(ay)?\b|theek|thik|deal|chalega|pakka|done|final|agree/i.test(clean);
  return agreeing ? pool[0].n : null;
}