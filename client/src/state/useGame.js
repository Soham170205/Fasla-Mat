import { useCallback, useRef, useState } from 'react';
import { api } from '../api/game';

const EMPTY = {
  sessionId: null,
  vendorId: null,
  shopkeeper: null,   // { name, sprite, mood }
  item: null,
  openingPrice: 0,
  currentPrice: 0,
  prices: [],         // every asking price so far, for the chalk slate
  patience: 100,
  messages: [],       // { from: 'vendor' | 'me' | 'system', text, event? }
  status: 'idle',     // idle | playing | deal | walked_away | kicked_out
  finalPrice: null,
  score: 0,
  savingsPct: 0,
  rating: null,
  saved: false,
  loading: false,
  error: null
};

let msgId = 0;
const msg = (from, text, event) => ({ id: ++msgId, from, text, event });

// One hook that holds the bargain the player is in. In-progress bargains are cached per vendor,
// so stepping away and coming back continues the same conversation.
export function useGame() {
  const [state, setState] = useState(EMPTY);
  const cache = useRef({});
  const active = useRef(null); // vendorId currently shown; late responses for others are ignored

  const merge = useCallback((vendorId, data, addMessages) => {
    if (active.current !== vendorId) return;
    setState(s => {
      const prices = s.prices[s.prices.length - 1] === data.currentPrice ? s.prices : [...s.prices, data.currentPrice];
      const next = {
        ...s,
        sessionId: data.sessionId,
        vendorId: data.vendorId,
        shopkeeper: data.shopkeeper,
        item: data.item,
        openingPrice: data.openingPrice,
        currentPrice: data.currentPrice,
        prices,
        patience: data.patience,
        status: data.status,
        finalPrice: data.finalPrice,
        score: data.score,
        savingsPct: data.savingsPct,
        rating: data.rating,
        saved: data.saved,
        loading: false,
        error: null,
        messages: [...s.messages, ...addMessages]
      };
      if (next.status === 'playing') cache.current[vendorId] = next;
      else delete cache.current[vendorId];
      return next;
    });
  }, []);

  const fail = useCallback((vendorId, e) => {
    if (active.current !== vendorId) return;
    setState(s => ({ ...s, loading: false, error: e.message, messages: [...s.messages, msg('system', e.message)] }));
  }, []);

  const open = useCallback(
    async vendor => {
      active.current = vendor.id;
      const cached = cache.current[vendor.id];
      if (cached) {
        setState({ ...cached, loading: false });
        return;
      }
      setState({
        ...EMPTY,
        vendorId: vendor.id,
        status: 'playing',
        loading: true,
        shopkeeper: { name: vendor.name, sprite: vendor.sprite, mood: 'neutral' },
        item: vendor.item,
        openingPrice: vendor.openingPrice,
        currentPrice: vendor.openingPrice,
        prices: [vendor.openingPrice]
      });
      try {
        const data = await api.start(vendor.id);
        merge(vendor.id, data, [msg('vendor', data.reply)]);
      } catch (e) {
        fail(vendor.id, e);
      }
    },
    [merge, fail]
  );

  const send = useCallback(
    async text => {
      const t = text.trim();
      if (!t || state.loading || !state.sessionId || state.status !== 'playing') return;
      const { vendorId, sessionId } = state;
      setState(s => ({ ...s, loading: true, messages: [...s.messages, msg('me', t)] }));
      try {
        const data = await api.message(sessionId, t);
        merge(vendorId, data, [msg('vendor', data.reply)]);
      } catch (e) {
        fail(vendorId, e);
      }
    },
    [state, merge, fail]
  );

  const accept = useCallback(async () => {
    if (state.loading || !state.sessionId || state.status !== 'playing') return;
    const { vendorId, sessionId } = state;
    setState(s => ({ ...s, loading: true, messages: [...s.messages, msg('me', `Theek hai, ₹${s.currentPrice} pakka.`)] }));
    try {
      const data = await api.accept(sessionId);
      merge(vendorId, data, [msg('vendor', data.reply)]);
    } catch (e) {
      fail(vendorId, e);
    }
  }, [state, merge, fail]);

  const walkAway = useCallback(async () => {
    if (state.loading || !state.sessionId || state.status !== 'playing') return;
    const { vendorId, sessionId } = state;
    setState(s => ({ ...s, loading: true, messages: [...s.messages, msg('me', 'Rehne do, main chalta hoon.')] }));
    try {
      const data = await api.walkAway(sessionId);
      merge(vendorId, data, [msg('vendor', data.reply, data.event)]);
    } catch (e) {
      fail(vendorId, e);
    }
  }, [state, merge, fail]);

  const close = useCallback(() => {
    active.current = null;
    setState(EMPTY);
  }, []);

  return { ...state, open, send, accept, walkAway, close };
}
