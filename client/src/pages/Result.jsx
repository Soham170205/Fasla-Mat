import { useEffect, useState } from 'react';
import { api } from '../api/game';
import { useAuth } from '../state/auth';
import Leaderboard from '../components/Leaderboard';
import AuthForm from '../components/AuthForm';

const TITLES = {
  deal: 'Deal pakka!',
  walked_away: 'Aap chal diye',
  kicked_out: 'Dukaan se nikaal diya!'
};
const SUBTITLES = {
  walked_away: 'No deal this time. Walk back to the stall to try again.',
  kicked_out: 'The shopkeeper ran out of patience. Give them 30 seconds to cool down.'
};

export default function Result({ result, onClose }) {
  const { user } = useAuth();
  const [board, setBoard] = useState(null);
  const [saved, setSaved] = useState(result.saved);
  const [mine, setMine] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const deal = result.status === 'deal';

  const refresh = () => api.leaderboard().then(setBoard).catch(() => setBoard({ players: [], deals: [] }));

  useEffect(() => {
    refresh();
    if (user && result.saved) api.myScores().then(setMine).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setError(null);
    try {
      const d = await api.saveDeal(result.sessionId);
      setSaved(true);
      setMine(d.me);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const share = `🛒 Fasla Mat\n${result.item.name} from ${result.vendor.name}\n₹${result.openingPrice} → ₹${result.finalPrice} (${result.savingsPct}% off), score ${result.score}\nCan you beat me? ${window.location.origin}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the text and copy it manually.');
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

            {saved ? (
              <p className="lb-done">
                Saved to your scores{mine?.rank ? `. You are #${mine.rank} with ${mine.total} points.` : '.'}
              </p>
            ) : user ? (
              <button type="button" className="btn btn-accept" onClick={save}>
                Save to my scores
              </button>
            ) : (
              <div className="result-auth">
                <p className="auth-hint">Log in or sign up to save this score.</p>
                <AuthForm initialMode="signup" onDone={save} />
              </div>
            )}

            <pre className="share">{share}</pre>
            <button type="button" className="btn btn-ghost" onClick={copy}>
              {copied ? 'Copied' : 'Copy to share'}
            </button>
          </>
        ) : (
          <p className="result-item">{SUBTITLES[result.status]}</p>
        )}

        {error && <p className="form-error">{error}</p>}

        <h3 className="lb-title">Leaderboard</h3>
        <Leaderboard data={board} limit={5} meId={user?.id} />

        <button type="button" className="btn btn-primary result-close" onClick={onClose}>
          Keep shopping
        </button>
      </div>
    </div>
  );
}
