import { useEffect, useRef, useState } from 'react';

export default function ChatBox({ messages, loading, disabled, shopkeeperName, onSend, inputRef }) {
  const [text, setText] = useState('');
  const logRef = useRef(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const submit = e => {
    e.preventDefault();
    if (!text.trim() || loading || disabled) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.map(m => (
          <p key={m.id} className={`msg msg-${m.from} ${m.event === 'called_back' ? 'msg-callback' : ''}`}>
            {m.text}
          </p>
        ))}
        {loading && <p className="msg msg-typing">{shopkeeperName} soch rahe hain…</p>}
      </div>
      <form className="chat-input" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="offer">Your offer</label>
        <input
          id="offer"
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          maxLength={300}
          autoComplete="off"
          placeholder={disabled ? 'Bargain over' : 'Bhaiya, ₹300 de do…'}
          disabled={disabled}
        />
        <button type="submit" className="btn btn-send" disabled={disabled || loading || !text.trim()}>
          Send offer
        </button>
      </form>
    </div>
  );
}
