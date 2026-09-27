export default function Leaderboard({ entries, limit = 10, highlight }) {
  if (!entries) return <p className="lb-empty">Loading scores…</p>;
  if (!entries.length) return <p className="lb-empty">No deals yet. Be the first name on the board.</p>;
  return (
    <ol className="leaderboard">
      {entries.slice(0, limit).map((e, i) => (
        <li key={`${e.name}-${e.createdAt}-${i}`} className={highlight && e.name === highlight ? 'is-me' : ''}>
          <span className="lb-rank">{i + 1}</span>
          <span className="lb-name">{e.name}</span>
          <span className="lb-deal">
            {e.item} from {e.vendorName}, ₹{e.openingPrice} to ₹{e.finalPrice}
          </span>
          <span className="lb-score">{e.score}</span>
        </li>
      ))}
    </ol>
  );
}
