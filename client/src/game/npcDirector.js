// Chooses what a walking NPC says next, so talking to them never feels like a loop:
// 1. unseen conversations whose conditions match (highest priority first), each shown once
// 2. then a return greeting + small-talk line, drawn from shuffle bags (no repeats until the bag empties)
// Memory is kept per player in localStorage, so a returning player continues where they left off.
import data from '../data/npc_dialogue.json';

const storageKey = player => `fm-npc-memory:${(player || 'guest').toLowerCase()}`;

function load(player) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(player))) || {};
  } catch {
    return {};
  }
}

function save(player, mem) {
  try {
    localStorage.setItem(storageKey(player), JSON.stringify(mem));
  } catch {
    /* private mode: memory lasts for this visit only */
  }
}

export function timeOfDay(hour) {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function matches(when = {}, ctx, visits) {
  if (when.minVisits && visits < when.minVisits) return false;
  if (when.maxVisits && visits > when.maxVisits) return false;
  if (when.boughtFrom && !ctx.bought.includes(when.boughtFrom)) return false;
  if (when.notBoughtFrom && ctx.bought.includes(when.notBoughtFrom)) return false;
  if (when.boughtAny && !ctx.bought.length) return false;
  if (when.boughtNone && ctx.bought.length) return false;
  if (when.minBought && ctx.bought.length < when.minBought) return false;
  if (when.kickedOutBy && !ctx.kickedOut.includes(when.kickedOutBy)) return false;
  if (when.vendorOfDay && ctx.vendorOfDay !== when.vendorOfDay) return false;
  if (when.timeOfDay && timeOfDay(ctx.hour) !== when.timeOfDay) return false;
  return true;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Draw from a shuffle bag; when refilled, the last item drawn is never first again
function draw(m, bagName, size) {
  m.bags ||= {};
  let bag = m.bags[bagName];
  if (!bag?.length) {
    const last = m.last?.[bagName];
    bag = shuffle([...Array(size).keys()]);
    if (bag.length > 1 && bag[0] === last) bag.push(bag.shift());
  }
  const i = bag.shift();
  m.bags[bagName] = bag;
  m.last = { ...(m.last || {}), [bagName]: i };
  return i;
}

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (all, k) => (vars[k] ?? all));

export const npcInfo = id => data.npcs[id];

/**
 * ctx: { player, memoryKey, bought: [vendorId], boughtItems: [name], kickedOut: [vendorId],
 *        vendorOfDay, vodName, vodShop, saved, hour }
 */
export function nextConversation(npcId, ctx) {
  const npc = data.npcs[npcId];
  if (!npc) return null;
  const mem = load(ctx.memoryKey || ctx.player);
  const m = (mem[npcId] ||= { visits: 0, seen: [] });
  m.visits += 1;

  let lines;
  const fresh = npc.conversations.filter(c => !m.seen.includes(c.id) && matches(c.when, ctx, m.visits));
  if (fresh.length) {
    const top = Math.max(...fresh.map(c => c.priority || 0));
    const pool = fresh.filter(c => (c.priority || 0) === top);
    const convo = pool[Math.floor(Math.random() * pool.length)];
    m.seen.push(convo.id);
    lines = convo.lines;
  } else {
    const greet = npc.returnGreetings[draw(m, 'greet', npc.returnGreetings.length)];
    const talk = npc.smallTalk[draw(m, 'small', npc.smallTalk.length)];
    lines = [{ speaker: 'npc', text: `${greet} ${talk}` }];
    // every few visits they have a bit more to say
    if (m.visits % 3 === 0) lines.push({ speaker: 'npc', text: npc.smallTalk[draw(m, 'small', npc.smallTalk.length)] });
  }
  save(ctx.memoryKey || ctx.player, mem);

  const vars = {
    player: ctx.player || 'dost',
    vod: ctx.vodName || 'koi',
    vodShop: ctx.vodShop || 'bazaar',
    saved: ctx.saved ?? 0,
    bought: ctx.boughtItems?.length ? ctx.boughtItems.join(' aur ') : 'kuch'
  };
  return {
    npcId,
    name: npc.name,
    role: npc.role,
    sprite: npc.sprite,
    lines: lines.map(l => ({ speaker: l.speaker, text: fill(l.text, vars) }))
  };
}
