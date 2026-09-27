import { useState } from 'react';

export default function Leaderboard({ data, limit = 10, meId }) {
  const [tab, setTab] = useState('players');
  if (!data) return <p className="lb-empty">Loading scores…</p>;
  const rows = (tab === 'players' ? data.players : data.deals) || [];

  return (
    <div>
      <div className="lb-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'players'} className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>
          Top players
        </button>
        <button type="button" role="tab" aria-selected={tab === 'deals'} className={tab === 'deals' ? 'on' : ''} onClick={() => setTab('deals')}>
          Best deals
        </button>
      </div>
      {!rows.length ? (
        <p className="lb-empty">No saved deals yet. Be the first name on the board.</p>
      ) : (
        <ol className="leaderboard">
          {rows.slice(0, limit).map((e, i) => (
            <li key={`${e.userId}-${e.createdAt || i}`} className={meId && e.userId === meId ? 'is-me' : ''}>
              <span className="lb-rank">{i + 1}</span>
              <span className="lb-name">{e.name}</span>
              <span className="lb-deal">
                {tab === 'players'
                  ? `${e.stalls}/3 stalls, ${e.deals} deal${e.deals === 1 ? '' : 's'}`
                  : `${e.item} from ${e.vendorName}, ₹${e.openingPrice} to ₹${e.finalPrice}`}
              </span>
              <span className="lb-score">{tab === 'players' ? e.total : e.score}</span>
            </li>
          ))}
        </ol>
      )}
      {tab === 'players' && <p className="lb-note">Total = your best score at each stall, added up.</p>}
    </div>
  );
}
