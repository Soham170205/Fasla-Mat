export default function PatienceMeter({ value }) {
  const blocks = 10;
  const filled = Math.ceil(value / 10);
  const level = value > 60 ? 'ok' : value > 30 ? 'warn' : 'low';
  return (
    <div className="patience">
      <span className="patience-label">Patience</span>
      <div className={`patience-bar ${level}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Shopkeeper patience">
        {Array.from({ length: blocks }, (_, i) => (
          <span key={i} className={i < filled ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
