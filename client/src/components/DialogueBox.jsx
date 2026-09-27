import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sound';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Classic RPG text box: typewriter text, press E / Enter / Space or tap to continue
export default function DialogueBox({ dialogue, playerName, onClose }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const openedAt = useRef(Date.now());
  const line = dialogue.lines[index];
  const done = shown >= line.text.length;
  const last = index === dialogue.lines.length - 1;

  useEffect(() => {
    if (reduced()) {
      setShown(line.text.length);
      return undefined;
    }
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      if (i > line.text.length) {
        clearInterval(t);
        return;
      }
      if (i % 2 === 0 && line.text[i - 1] !== ' ') sfx.tick();
      setShown(i);
    }, 22);
    return () => clearInterval(t);
  }, [line]);

  const advance = useCallback(() => {
    if (Date.now() - openedAt.current < 200) return;   // ignore the key press that opened the box
    if (!done) return setShown(line.text.length);
    if (last) return onClose();
    sfx.advance();
    setIndex(i => i + 1);
  }, [done, last, line, onClose]);

  useEffect(() => {
    const onKey = e => {
      if (['e', 'E', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        advance();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onClose]);

  const isYou = line.speaker === 'you';
  return (
    <div className="dialogue" role="dialog" aria-label={`Talking with ${dialogue.name}`} onClick={advance}>
      <span className={`dlg-name ${isYou ? 'is-you' : ''}`}>{isYou ? playerName || 'You' : dialogue.name}</span>
      <p className="dlg-text" aria-live="polite">
        {line.text.slice(0, shown)}
        <span className="dlg-ghost" aria-hidden="true">{line.text.slice(shown)}</span>
      </p>
      <span className="dlg-next" aria-hidden="true">{done ? (last ? '■' : '▼') : ''}</span>
      <span className="dlg-count">
        {index + 1}/{dialogue.lines.length}
      </span>
    </div>
  );
}
