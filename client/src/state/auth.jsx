import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken } from '../api/game';

const AuthContext = createContext(null);
const KEY = 'fm-token';

function storedToken() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const keep = useCallback((token, u) => {
    setToken(token);
    try {
      if (token) localStorage.setItem(KEY, token);
      else localStorage.removeItem(KEY);
    } catch {
      /* private mode */
    }
    setUser(u);
  }, []);

  // Restore the session on page load
  useEffect(() => {
    const t = storedToken();
    if (!t) {
      setReady(true);
      return;
    }
    setToken(t);
    api
      .me()
      .then(d => setUser(d.user))
      .catch(() => keep(null, null))
      .finally(() => setReady(true));
  }, [keep]);

  const value = useMemo(
    () => ({
      user,
      ready,
      login: async (username, password) => {
        const d = await api.login(username, password);
        keep(d.token, d.user);
        return d.user;
      },
      signup: async (username, password, displayName) => {
        const d = await api.signup(username, password, displayName);
        keep(d.token, d.user);
        return d.user;
      },
      logout: () => keep(null, null)
    }),
    [user, ready, keep]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
