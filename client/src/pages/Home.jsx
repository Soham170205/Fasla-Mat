import { useEffect, useState } from 'react';
import { api } from '../api/game';
import { useAuth } from '../state/auth';
import Leaderboard from '../components/Leaderboard';
import AuthForm from '../components/AuthForm';

export default function Home({ onEnter }) {
  const { user, ready, logout } = useAuth();
  const [info, setInfo] = useState(null);
  const [board, setBoard] = useState(null);
  const [mine, setMine] = useState(null);
  const [guest, setGuest] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    api.vendors().then(setInfo).catch(e => setError(e.message));
    api.leaderboard().then(setBoard).catch(() => setBoard({ players: [], deals: [] }));
  }, []);

  useEffect(() => {
    if (!user) return setMine(null);
    api.myScores().then(setMine).catch(() => setMine(null));
  }, [user]);

  const special = info?.vendors.find(v => v.id === info.vendorOfDay);

  return (
    <main className="home">
      <section className="home-main">
        <div className="signboard">
          <h1>Fasla Mat</h1>
          <p>Mumbai ka mol-bhaav bazaar</p>
        </div>

        <p className="home-lede">
          Three shopkeepers, three stalls, one rule: pay less than everyone else. Talk them down in Hinglish, English or
          Marathi, and chat with the locals for tips. Push too hard and you get thrown out.
        </p>

        {special && <p className="home-special">Aaj ka special: {special.name} at {special.shop}</p>}
        {error && <p className="form-error">{error}</p>}
        {info && !info.aiEnabled && (
          <p className="demo-note">Demo mode: each shopkeeper answers from about 120 written lines until an API key is added on the server.</p>
        )}

        {!ready ? null : user ? (
          <div className="account">
            <p className="account-hello">
              Namaste, <strong>{user.displayName}</strong>
            </p>
            {mine && (
              <p className="account-stats">
                {mine.deals ? `Rank #${mine.rank} with ${mine.total} points from ${mine.deals} saved deal${mine.deals === 1 ? '' : 's'}.` : 'No saved deals yet. Your scores save automatically.'}
              </p>
            )}
            <div className="lb-row">
              <button type="button" className="btn btn-primary" onClick={() => onEnter()}>
                Enter the market
              </button>
              <button type="button" className="btn btn-ghost" onClick={logout}>
                Log out
              </button>
            </div>
            {mine?.best?.length > 0 && (
              <>
                <h3 className="lb-title account-best">Your best deals</h3>
                <ul className="my-deals">
                  {mine.best.slice(0, 3).map(d => (
                    <li key={d.createdAt}>
                      {d.item}: ₹{d.openingPrice} to ₹{d.finalPrice} <span>{d.score} pts</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <div className="account">
            <AuthForm />
            <div className="guest">
              <label htmlFor="guest">Or play as a guest</label>
              <div className="lb-row">
                <input id="guest" value={guest} maxLength={20} placeholder="Grahak" onChange={e => setGuest(e.target.value)} />
                <button type="button" className="btn btn-walk" onClick={() => onEnter(guest.trim() || 'Grahak')}>
                  Play as guest
                </button>
              </div>
              <p className="auth-hint">Guests can play, but a score is only saved once you log in.</p>
            </div>
          </div>
        )}

        <ol className="how">
          <li>Walk with WASD or the arrow keys, or tap where you want to go.</li>
          <li>Press E next to a shopkeeper to bargain, or next to a passer-by to chat.</li>
          <li>Make offers, give reasons, and accept when the price is right.</li>
        </ol>
      </section>

      <section className="home-board" aria-labelledby="home-lb">
        <h2 id="home-lb" className="lb-title">Leaderboard</h2>
        <Leaderboard data={board} limit={8} meId={user?.id} />
      </section>
    </main>
  );
}
