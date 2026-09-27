import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/game';
import { bus } from '../game/bus';
import { createGame } from '../game/createGame';
import { useGame } from '../state/useGame';
import Shop from './Shop';
import Result from './Result';

const ENDED = ['deal', 'walked_away', 'kicked_out'];

export default function Market({ playerName, onExit }) {
  const hostRef = useRef(null);
  const endRef = useRef(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [nearId, setNearId] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [bag, setBag] = useState([]);
  const game = useGame();

  const vendorsById = useMemo(() => Object.fromEntries((data?.vendors || []).map(v => [v.id, v])), [data]);
  const vendor = game.vendorId ? vendorsById[game.vendorId] : null;

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

  // Phaser -> React
  const { open } = game;
  useEffect(() => {
    const onNear = id => setNearId(id);
    const onTalk = id => {
      const v = vendorsById[id];
      if (!v) return bus.emit('resume');
      setShopOpen(true);
      open(v);
    };
    bus.on('near', onNear);
    bus.on('talk', onTalk);
    return () => {
      bus.off('near', onNear);
      bus.off('talk', onTalk);
    };
  }, [vendorsById, open]);

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
      rating: game.rating
    };
    if (game.status === 'deal') {
      bus.emit('sold', game.vendorId);
      setBag(b => [...b, { item: game.item.name, saved: game.openingPrice - game.finalPrice }]);
    }
    if (game.status === 'kicked_out') bus.emit('cooldown', game.vendorId, 30000);
    const t = setTimeout(finishBargain, 1600);
    return () => clearTimeout(t);
  }, [game.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shopOpen) return undefined;
    const onKey = e => e.key === 'Escape' && finishBargain();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const closeResult = () => {
    setResult(null);
    bus.emit('resume');
  };

  const saved = bag.reduce((a, b) => a + b.saved, 0);
  const nearVendor = nearId ? vendorsById[nearId] : null;

  return (
    <div className="market">
      <header className="hud">
        <span className="hud-brand">Fasla Mat</span>
        <span className="hud-stat">{playerName}</span>
        <span className="hud-stat">
          Bag: {bag.length ? bag.map(b => b.item).join(', ') : 'empty'}
        </span>
        <span className="hud-stat hud-saved">Saved ₹{saved}</span>
        {data && !data.aiEnabled && <span className="hud-demo">Demo mode</span>}
        <button type="button" className="btn btn-ghost hud-exit" onClick={onExit}>
          Leave market
        </button>
      </header>

      <div className="stage">
        <div className="game-host" ref={hostRef} />
        {loadError && (
          <div className="stage-error">
            <p>{loadError}</p>
            <p>Start the server with npm run dev, then reload this page.</p>
          </div>
        )}

        {nearVendor && !shopOpen && !result && (
          <button type="button" className="talk-prompt" onClick={() => bus.emit('requestTalk', nearVendor.id)}>
            Talk to {nearVendor.name} <kbd>E</kbd>
          </button>
        )}

        {shopOpen && vendor && <Shop game={game} vendor={vendor} onClose={finishBargain} />}
      </div>

      {result && <Result result={result} playerName={playerName} onClose={closeResult} />}
    </div>
  );
}
