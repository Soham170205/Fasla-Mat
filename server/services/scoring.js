export function savingsPct(s) {
  if (s.status !== 'deal') return 0;
  return Math.round(((s.openingPrice - s.finalPrice) / s.openingPrice) * 100);
}

// 0-100 for how close you got to the secret floor, plus up to 30 for doing it quickly
export function computeScore(s) {
  if (s.status !== 'deal') return 0;
  const range = s.openingPrice - s.floorPrice;
  const pct = Math.max(0, Math.min(1, (s.openingPrice - s.finalPrice) / range));
  const speedBonus = Math.round(Math.max(0, 10 - s.turns) * 3 * pct);
  return Math.round(pct * 100) + speedBonus;
}

export function rating(score) {
  if (score >= 100) return 'Mandi King. Vendor ro raha hai!';
  if (score >= 70) return 'Pakka mol-bhaav expert.';
  if (score >= 40) return 'Theek-thaak. Thoda aur ladna tha.';
  if (score > 0) return 'Vendor ne aapko loot liya.';
  return 'Koi deal nahi hui.';
}
