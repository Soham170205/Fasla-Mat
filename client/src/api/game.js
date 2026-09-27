// Every server call lives here
const BASE = import.meta.env.VITE_API_URL || '';

async function req(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch {
    throw new Error('Cannot reach the server. Check that it is running.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const post = (path, body) => req(path, { method: 'POST', body: JSON.stringify(body || {}) });

export const api = {
  vendors: () => req('/game/vendors'),
  start: vendorId => post('/game/start', { vendorId }),
  message: (sessionId, text) => post(`/game/${sessionId}/message`, { text }),
  accept: sessionId => post(`/game/${sessionId}/accept`),
  walkAway: sessionId => post(`/game/${sessionId}/walkaway`),
  leaderboard: () => req('/leaderboard'),
  submitScore: (sessionId, name) => post('/leaderboard', { sessionId, name })
};
