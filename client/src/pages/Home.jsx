import { useEffect, useState } from 'react';
import { api } from '../api/game';
import Leaderboard from '../components/Leaderboard';

export default function Home({ initialName, onEnter }) {
  const [name, setName] = useState(initialName || '');
  const [info, setInfo] = useState(null);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.vendors().then(setInfo).catch(e => setError(e.message));
    api.leaderboard().then(d => setEntries(d.entries)).catch(() => setEntries([]));
  }, []);

  const special = info?.vendors.find(v => v.id === info.vendorOfDay);

  const submit = e => {
    e.preventDefault();
    onEnter(name.trim().slice(0, 20) || 'Grahak');
  };

  return (
    <main className="home">
      <section className="home-main">
        <div className="signboard">
          <h1>Fasla Mat</h1>
          <p>Mumbai ka mol-bhaav bazaar</p>
        </div>

        <p className="home-lede">
          Three shopkeepers, three stalls, one rule: pay less than everyone else. Talk them down in Hinglish, English or
          Marathi. Push too hard and they will throw you out.
        </p>

        {special && (
          <p className="home-special">
            Aaj ka special: {special.name} at {special.shop}
          </p>
        )}

        <form className="home-form" onSubmit={submit}>
          <label htmlFor="name">Your name</label>
          <div className="lb-row">
            <input id="name" value={name} maxLength={20} placeholder="Grahak" onChange={e => setName(e.target.value)} />
            <button type="submit" className="btn btn-primary">Enter the market</button>
          </div>
        </form>

        {error && <p className="form-error">{error}</p>}
        {info && !info.aiEnabled && (
          <p className="demo-note">Demo mode: shopkeepers follow simple rules until an API key is added on the server.</p>
        )}

        <ol className="how">
          <li>Walk with WASD or the arrow keys, or tap where you want to go.</li>
          <li>Stand in front of a shopkeeper and press E, or tap them.</li>
          <li>Make offers, give reasons, and accept when the price is right.</li>
        </ol>
      </section>

      <section className="home-board" aria-labelledby="home-lb">
        <h2 id="home-lb" className="lb-title">Top bargainers</h2>
        <Leaderboard entries={entries} limit={5} />
      </section>
    </main>
  );
}
