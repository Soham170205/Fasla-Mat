const MOODS = {
  happy: { face: '😄', text: 'Khush' },
  neutral: { face: '🙂', text: 'Soch-vichaar mein' },
  annoyed: { face: '😒', text: 'Chidchida' },
  angry: { face: '😡', text: 'Gusse mein' }
};

export default function Shopkeeper({ name, shop, sprite, mood = 'neutral' }) {
  const m = MOODS[mood] || MOODS.neutral;
  return (
    <div className="shopkeeper">
      <div className="sk-portrait" aria-hidden="true">
        <div className="sk-sprite" style={{ backgroundImage: `url(/assets/npc/${sprite}_idle.png)` }} />
        <span className="sk-face" key={mood}>{m.face}</span>
      </div>
      <div>
        <h2 className="sk-name">{name}</h2>
        {shop && <p className="sk-shop">{shop}</p>}
        <p className="sk-mood">Mood: {m.text}</p>
      </div>
    </div>
  );
}
