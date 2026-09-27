// The chalk slate: every old price stays on the board, struck through
export default function PriceTag({ item, prices, current, status }) {
  const old = prices.slice(0, -1).slice(-3);
  return (
    <div className="slate" aria-label={`${item?.name}, current price ₹${current}`}>
      <p className="slate-item">{item?.name}</p>
      <div className="slate-prices">
        {old.map((p, i) => (
          <s key={`${p}-${i}`} className="slate-old">₹{p}</s>
        ))}
        <strong key={current} className={`slate-now ${status === 'deal' ? 'is-deal' : ''}`}>
          ₹{current}
        </strong>
      </div>
    </div>
  );
}
