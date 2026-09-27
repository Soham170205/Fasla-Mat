import { useEffect, useState } from 'react';
import { api } from '../api/game';
import Leaderboard from '../components/Leaderboard';

const TITLES = {
  deal: 'Deal pakka!',
  walked_away: 'Aap chal diye',
  kicked_out: 'Dukaan se nikaal diya!'
};
const SUBTITLES = {
  walked_away: 'No deal this time. Walk back to the stall to try again.',
  kicked_out: 'The shopkeeper ran out of patience. Give them 30 seconds to cool down.'
};

export default function Result({ result, playerName, onClose }) {
  const [entries, setEntries] = useState(null);
  const [name, setName] = useState(playerName || '');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const deal = result.status === 'deal';

  useEffect(() => {
    api.leaderboard().then(d => setEntries(d.entries)).catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const share = `🛒 Fasla Mat\n${result.item.name} from ${result.vendor.name}\n₹${result.openingPrice} → ₹${result.finalPrice} (${result.savingsPct}% off), score ${result.score}\nCan you beat me? ${window.location.origin}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the text and copy it manually.');
    }
  };

  const submit = async e => {
    e.preventDefault();
    setError(null);
    try {
      const d = await api.submitScore(result.sessionId, name);
      setEntries(d.entries);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="result-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className={`result result-${result.status}`}>
        <h2 id="result-title" className="result-title">{TITLES[result.status]}</h2>

        {deal ? (
          <>
            <p className="result-item">
              {result.item.name}, from {result.vendor.name}
            </p>
            <div className="slate result-slate">
              <div className="slate-prices">
                <s className="slate-old">₹{result.openingPrice}</s>
                <strong className="slate-now is-deal">₹{result.finalPrice}</strong>
              </div>
              <p className="slate-item">{result.savingsPct}% saved</p>
            </div>
            <p className="result-score">
              <span className="score-num">{result.score}</span> points. {result.rating}
            </p>
            <pre className="share">{share}</pre>
            <button type="button" className="btn btn-ghost" onClick={copy}>
              {copied ? 'Copied' : 'Copy to share'}
            </button>

            {!submitted ? (
              <form className="lb-form" onSubmit={submit}>
                <label htmlFor="lb-name">Name on the leaderboard</label>
                <div className="lb-row">
                  <input id="lb-name" value={name} maxLength={20} onChange={e => setName(e.target.value)} onKeyDown={e => e.stopPropagation()} />
                  <button type="submit" className="btn btn-accept">Add my score</button>
                </div>
              </form>
            ) : (
              <p className="lb-done">Your score is on the board.</p>
            )}
          </>
        ) : (
          <p className="result-item">{SUBTITLES[result.status]}</p>
        )}

        {error && <p className="form-error">{error}</p>}

        <h3 className="lb-title">Top bargainers</h3>
        <Leaderboard entries={entries} limit={5} highlight={submitted ? name : null} />

        <button type="button" className="btn btn-primary result-close" onClick={onClose} autoFocus>
          Keep shopping
        </button>
      </div>
    </div>
  );
}
