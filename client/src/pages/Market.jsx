import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/game';
import { bus } from '../game/bus';
import { createGame } from '../game/createGame';
import { nextConversation } from '../game/npcDirector';
import { useGame } from '../state/useGame';
import { useAuth } from '../state/auth';
import DialogueBox from '../components/DialogueBox';
import Shop from './Shop';
import Result from './Result';
import { duck, sfx, isMuted, setMuted, unlockAudio } from '../audio/sound';

const ENDED = ['deal', 'walked_away', 'kicked_out'];

export default function Market({ playerName, onExit }) {
  const { user } = useAuth();
  const hostRef = useRef(null);
  const endRef = useRef(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [near, setNear] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [dialogue, setDialogue] = useState(null);
  const [bag, setBag] = useState([]);
  const [kickedOut, setKickedOut] = useState([]);
  const game = useGame();
    // ---------------------------------------------------------------- sound
  const [muted, setMutedState] = useState(isMuted());
  const toggleSound = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    setMutedState(next);
    if (!next) unlockAudio();
  }, []);

  // M toggles sound
  useEffect(() => {
    const onKey = e => {
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if ((e.key === 'm' || e.key === 'M') && !typing) toggleSound();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [toggleSound]);

  // quieter music during conversations
  useEffect(() => {
    duck(shopOpen || Boolean(dialogue) || Boolean(result));
    return () => duck(false);
  }, [shopOpen, dialogue, result]);

  // chat sounds: your offer, their reply, a price drop, a call-back
  const heard = useRef({ count: 0, price: null });
  useEffect(() => {
    const msgs = game.messages;
    const h = heard.current;
    if (msgs.length <= h.count) {
      h.count = msgs.length;
      h.price = game.currentPrice;
      return;
    }
    const m = msgs[msgs.length - 1];
    if (m.from === 'me') sfx.send();
    else if (m.from === 'vendor') {
      if (m.event === 'called_back') sfx.callback();
      else if (h.price && msgs.length > 1 && game.currentPrice < h.price) sfx.priceDrop();
      else sfx.reply();
    }
    h.count = msgs.length;
    h.price = game.currentPrice;
  }, [game.messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // how the bargain ended
  useEffect(() => {
    if (game.status === 'deal') sfx.deal();
    else if (game.status === 'kicked_out') sfx.fail();
    else if (game.status === 'walked_away') sfx.walkAway();
  }, [game.status]);

  const vendorsById = useMemo(() => Object.fromEntries((data?.vendors || []).map(v => [v.id, v])), [data]);
  const vendor = game.vendorId ? vendorsById[game.vendorId] : null;
  const saved = bag.reduce((a, b) => a + b.saved, 0);

  useEffect(() => {
    api.vendors().then(setData).catch(e => setLoadError(e.message));
  }, []);

  // Mount Phaser once vendor data is here
  useEffect(() => {
    if (!data || !hostRef.current) return undefined;
    let cancelled = false;
    let instance = null;
    createGame(hostRef.current, { vendors: data.vendors, vendorOfDay: data.vendorOfDay }).then(g => {
      if (cancelled) g.destroy(true);
      else instance = g;
    });
    return () => {
      cancelled = true;
      instance?.destroy(true);
    };
  }, [data]);

  // What the walking NPCs know about you right now
  const context = useRef({});
  context.current = {
    player: playerName,
    memoryKey: user?.username || `guest:${playerName}`,
    bought: bag.map(b => b.vendorId),
    boughtItems: bag.map(b => b.item),
    kickedOut,
    vendorOfDay: data?.vendorOfDay,
    vodName: vendorsById[data?.vendorOfDay]?.name,
    vodShop: vendorsById[data?.vendorOfDay]?.shop,
    saved,
    hour: new Date().getHours()
  };

  // Phaser -> React
  const { open } = game;
  useEffect(() => {
    const onNear = n => setNear(n);
    const onTalk = id => {
      const v = vendorsById[id];
      if (!v) return bus.emit('resume');
      sfx.shopOpen();
      setShopOpen(true);
      open(v);
    };
    const onTalkNpc = id => {
      const convo = nextConversation(id, context.current);
      if (convo) {
        sfx.talk();
        setDialogue({ ...convo, uid: Date.now() });
      } else bus.emit('resume');
    };
    bus.on('near', onNear);
    bus.on('talk', onTalk);
    bus.on('talkNpc', onTalkNpc);
    return () => {
      bus.off('near', onNear);
      bus.off('talk', onTalk);
      bus.off('talkNpc', onTalkNpc);
    };
  }, [vendorsById, open]);

  const closeDialogue = useCallback(() => {
    setDialogue(null);
    bus.emit('resume');
  }, []);

  // React -> Phaser: show the vendor's mood above their head
  const mood = game.shopkeeper?.mood;
  useEffect(() => {
    if (game.vendorId && mood) bus.emit('mood', game.vendorId, mood);
  }, [mood]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishBargain = () => {
    const snap = endRef.current;
    endRef.current = null;
    setShopOpen(false);
    game.close();
    if (snap) setResult(snap);
    else bus.emit('resume');
  };

  // A bargain just ended: record it, then show the result after the last line can be read
  useEffect(() => {
    if (!ENDED.includes(game.status)) return undefined;
    const v = vendorsById[game.vendorId];
    endRef.current = {
      status: game.status,
      sessionId: game.sessionId,
      vendor: v,
      item: game.item,
      openingPrice: game.openingPrice,
      finalPrice: game.finalPrice,
      savingsPct: game.savingsPct,
      score: game.score,
      rating: game.rating,
      saved: game.saved
    };
    if (game.status === 'deal') {
      bus.emit('sold', game.vendorId);
      setBag(b => [...b, { vendorId: game.vendorId, item: game.item.name, saved: game.openingPrice - game.finalPrice }]);
    }
    if (game.status === 'kicked_out') {
      bus.emit('cooldown', game.vendorId, 30000);
      setKickedOut(k => (k.includes(game.vendorId) ? k : [...k, game.vendorId]));
    }
    const t = setTimeout(finishBargain, 1600);
    return () => clearTimeout(t);
  }, [game.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shopOpen) return undefined;
    const onKey = e => e.key === 'Escape' && finishBargain();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const closeResult = useCallback(() => {
    setResult(null);
    bus.emit('resume');
  }, []);

  return (
    <div className="market">
      <header className="hud">
        <span className="hud-brand">Fasla Mat</span>
        <span className="hud-stat">{user ? user.displayName : `${playerName} (guest)`}</span>
        <span className="hud-stat">Bag: {bag.length ? bag.map(b => b.item).join(', ') : 'empty'}</span>
        <span className="hud-stat hud-saved">Saved ₹{saved}</span>
        {data && !data.aiEnabled && <span className="hud-demo">Demo mode</span>}
        <button type="button" className="btn btn-ghost hud-exit" onClick={onExit}>
          {user ? 'Leave market' : 'Leave, or log in to save'}
        </button>
        <button type="button" className="hud-sound" onClick={toggleSound} aria-pressed={!muted} title="Sound on/off (M)">
          {muted ? '🔇' : '🔊'}
          <span className="visually-hidden">{muted ? 'Turn sound on' : 'Turn sound off'}</span>
        </button>
      </header>

      <div className="stage">
        <div className="game-host" ref={hostRef} />
        {loadError && (
          <div className="stage-error">
            <p>{loadError}</p>
            <p>Start the server with npm start, then reload this page.</p>
          </div>
        )}

        {near && !shopOpen && !result && !dialogue && (
          <button type="button" className="talk-prompt" onClick={() => bus.emit('requestTalk', { kind: near.kind, id: near.id })}>
            {near.kind === 'vendor' ? 'Bargain with' : 'Talk to'} {near.name} <kbd>E</kbd>
          </button>
        )}

        {dialogue && <DialogueBox key={dialogue.uid} dialogue={dialogue} playerName={playerName} onClose={closeDialogue} />}
        {shopOpen && vendor && <Shop game={game} vendor={vendor} onClose={finishBargain} />}
      </div>

      {result && <Result result={result} onClose={closeResult} />}
    </div>
  );
}
