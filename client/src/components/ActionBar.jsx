const QUICK = ['Thoda kam karo na', 'Main roz aaunga', 'Dusri dukaan mein sasta hai'];

export default function ActionBar({ price, disabled, onAccept, onWalkAway, onQuick }) {
  return (
    <div className="actions">
      <div className="quick" aria-label="Quick lines">
        {QUICK.map(q => (
          <button key={q} type="button" className="chip" disabled={disabled} onClick={() => onQuick(q)}>
            {q}
          </button>
        ))}
      </div>
      <div className="action-row">
        <button type="button" className="btn btn-accept" disabled={disabled} onClick={onAccept}>
          Accept ₹{price}
        </button>
        <button type="button" className="btn btn-walk" disabled={disabled} onClick={onWalkAway}>
          Walk away
        </button>
      </div>
    </div>
  );
}
