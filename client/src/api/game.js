// Every server call lives here
const BASE = import.meta.env.VITE_API_URL || '';
let token = null;
export const setToken = t => {
  token = t;
};

async function req(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error('Cannot reach the server. Check that it is running.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const post = (path, body) => req(path, { method: 'POST', body: JSON.stringify(body || {}) });

export const api = {
  vendors: () => req('/game/vendors'),
  start: vendorId => post('/game/start', { vendorId }),
  message: (sessionId, text) => post(`/game/${sessionId}/message`, { text }),
  accept: sessionId => post(`/game/${sessionId}/accept`),
  walkAway: sessionId => post(`/game/${sessionId}/walkaway`),

  signup: (username, password, displayName) => post('/auth/signup', { username, password, displayName }),
  login: (username, password) => post('/auth/login', { username, password }),
  me: () => req('/auth/me'),

  leaderboard: () => req('/leaderboard'),
  myScores: () => req('/leaderboard/me'),
  saveDeal: sessionId => post('/leaderboard', { sessionId })
};
