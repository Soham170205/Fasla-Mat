import { useState } from 'react';
import { useAuth } from '../state/auth';

export default function AuthForm({ onDone, initialMode = 'login' }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';

  const submit = async e => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = isSignup ? await signup(username, password, displayName) : await login(username, password);
      onDone?.(u);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const stop = e => e.stopPropagation();

  return (
    <form className="auth" onSubmit={submit} onKeyDown={stop}>
      <div className="auth-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? 'on' : ''} onClick={() => setMode('login')}>
          Log in
        </button>
        <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? 'on' : ''} onClick={() => setMode('signup')}>
          Sign up
        </button>
      </div>

      <label htmlFor="auth-user">Username</label>
      <input
        id="auth-user"
        value={username}
        onChange={e => setUsername(e.target.value.toLowerCase())}
        autoComplete="username"
        placeholder="soham_22"
        maxLength={20}
        required
      />
      {isSignup && (
        <>
          <label htmlFor="auth-display">Name on the leaderboard</label>
          <input id="auth-display" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={24} placeholder="Soham" />
        </>
      )}
      <label htmlFor="auth-pass">Password</label>
      <input
        id="auth-pass"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        minLength={6}
        required
      />
      {isSignup && <p className="auth-hint">Username: 3-20 lowercase letters, numbers or _. Password: at least 6 characters.</p>}
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
        {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
      </button>
    </form>
  );
}
