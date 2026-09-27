import { findVendor } from '../data/items.js';
import { addEntry, hasEntry } from './leaderboardStore.js';

// Returns false if this session was already saved
export async function saveDeal(s, user) {
  if (s.status !== 'deal' || (await hasEntry(s.id))) return false;
  const v = findVendor(s.vendorId);
  await addEntry({
    sessionId: s.id,
    userId: user.id,
    name: user.displayName,
    vendorId: v.id,
    vendorName: v.name,
    item: v.item.name,
    openingPrice: s.openingPrice,
    finalPrice: s.finalPrice,
    savingsPct: s.savingsPct,
    turns: s.turns,
    score: s.score
  });
  s.userId = user.id;
  return true;
}
