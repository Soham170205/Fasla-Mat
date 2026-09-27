// Fasla Mat audio. The only background sound is the music track in client/public/audio/music.wav
// (an .mp3/.ogg/.m4a with the same name works too). Sound effects are synthesized with the Web Audio API.

const MUSIC_LEVEL = 0.5;
const MUSIC_DUCKED_LEVEL = 0.2;
const MUSIC_FILES = ['/audio/music.wav', '/audio/music.mp3', '/audio/music.ogg', '/audio/music.m4a'];

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let musicStarted = false;
let ducked = false;
let whiteNoise = null;
let muted = (() => {
  try {
    return localStorage.getItem('fm-muted') === '1';
  } catch {
    return false;
  }
})();

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(master);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.9;
  sfxGain.connect(master);
  return ctx;
}

// Browsers only allow sound after a click, tap or key press
export function unlockAudio() {
  const c = ensure();
  if (c && c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => {});
}

// Listen in the capture phase so nothing on the page (Phaser, dialogs) can swallow the gesture.
// pointerup/touchend matter on phones, where pointerdown alone does not count as a user gesture.
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
export function installUnlock() {
  const unlock = () => {
    unlockAudio();
    if (ctx?.state === 'running') remove();
  };
  const remove = () => UNLOCK_EVENTS.forEach(e => window.removeEventListener(e, unlock, true));
  UNLOCK_EVENTS.forEach(e => window.addEventListener(e, unlock, true));
  return remove;
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem('fm-muted', value ? '1' : '0');
  } catch {
    /* private mode */
  }
  if (master) master.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.05);
}

// ------------------------------------------------------------------ building blocks
function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function envelope(g, t, attack, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone({ freq, to, dur = 0.1, type = 'square', vol = 0.08, when = 0, attack = 0.005 }) {
  if (!ensure() || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  envelope(g, t, attack, vol, dur);
  o.connect(g).connect(sfxGain);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

function whoosh(dur = 0.45, from = 300, to = 2400, vol = 0.18) {
  if (!ensure() || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  whiteNoise ||= noiseBuffer(2);
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  envelope(g, t, 0.06, vol, dur);
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t);
  src.stop(t + dur + 0.1);
}

// ------------------------------------------------------------------ background music
// Starts the looping track once for the whole app; it keeps playing across screens.
export async function startMusic() {
  if (!ensure() || musicStarted) return;
  musicStarted = true;
  unlockAudio();
  for (const url of MUSIC_FILES) {
    try {
      const res = await fetch(url);
      // the dev server answers missing files with index.html, so check it really is audio
      if (!res.ok || !(res.headers.get('content-type') || '').startsWith('audio')) continue;
      const src = ctx.createBufferSource();
      src.buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      src.loop = true;
      src.connect(musicGain);
      src.start();
      musicGain.gain.setTargetAtTime(ducked ? MUSIC_DUCKED_LEVEL : MUSIC_LEVEL, ctx.currentTime, 1);
      return;
    } catch {
      /* try the next format */
    }
  }
  musicStarted = false; // no music file found; a later call can try again
}

// Quieter music while you are in a conversation
export function duck(on) {
  ducked = on;
  if (!ctx || !musicStarted) return;
  musicGain.gain.setTargetAtTime(on ? MUSIC_DUCKED_LEVEL : MUSIC_LEVEL, ctx.currentTime, 0.4);
}

// ------------------------------------------------------------------ sound effects
export const sfx = {
  // walking NPC starts talking: two-note chirp
  talk: () => {
    tone({ freq: 660, dur: 0.06, vol: 0.06 });
    tone({ freq: 880, dur: 0.08, vol: 0.06, when: 0.07 });
  },
  // typewriter text in the dialogue box
  tick: () => tone({ freq: 1250 + Math.random() * 150, dur: 0.018, vol: 0.025 }),
  // next line in the dialogue box
  advance: () => tone({ freq: 520, to: 700, dur: 0.05, vol: 0.05 }),
  // opening a shop: coins on the counter
  shopOpen: () => {
    [1800, 2400, 2100].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'sine', vol: 0.07, when: i * 0.06 }));
  },
  // you sent an offer
  send: () => tone({ freq: 900, to: 600, dur: 0.06, type: 'triangle', vol: 0.08 }),
  // shopkeeper answered
  reply: () => tone({ freq: 440, to: 520, dur: 0.08, type: 'triangle', vol: 0.07 }),
  // the price on the slate went down
  priceDrop: () => {
    [880, 740, 660].forEach((f, i) => tone({ freq: f, dur: 0.09, type: 'triangle', vol: 0.08, when: i * 0.07 }));
  },
  // shopkeeper called you back after walking away
  callback: () => {
    tone({ freq: 700, to: 900, dur: 0.1, vol: 0.07 });
    tone({ freq: 700, to: 900, dur: 0.1, vol: 0.07, when: 0.16 });
  },
  // deal done: rising arpeggio plus a coin shimmer
  deal: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', vol: 0.06, when: i * 0.09 }));
    [2400, 2800, 3200].forEach((f, i) => tone({ freq: f, dur: 0.2, type: 'sine', vol: 0.04, when: 0.4 + i * 0.05 }));
  },
  // thrown out of the shop
  fail: () => tone({ freq: 180, to: 80, dur: 0.45, type: 'sawtooth', vol: 0.08 }),
  // you walked away
  walkAway: () => whoosh()
};