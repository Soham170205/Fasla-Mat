import { useEffect, useRef } from 'react';
import Shopkeeper from '../components/Shopkeeper';
import PriceTag from '../components/PriceTag';
import PatienceMeter from '../components/PatienceMeter';
import ChatBox from '../components/ChatBox';
import ActionBar from '../components/ActionBar';

// The haggling screen: slides over the market while you talk to one vendor
export default function Shop({ game, vendor, onClose }) {
  const inputRef = useRef(null);
  const playing = game.status === 'playing';

  useEffect(() => {
    if (!game.loading && playing) inputRef.current?.focus();
  }, [game.loading, playing]);

  return (
    <aside className="shop" role="dialog" aria-label={`Bargaining with ${vendor.name}`}>
      <header className="shop-head">
        <Shopkeeper name={vendor.name} shop={vendor.shop} sprite={vendor.sprite} mood={game.shopkeeper?.mood} />
        <button type="button" className="shop-close" onClick={onClose} title="Back to the market (Esc)">
          <span aria-hidden="true">✕</span>
          <span className="visually-hidden">Back to the market</span>
        </button>
      </header>

      <PriceTag item={game.item} prices={game.prices} current={game.currentPrice} status={game.status} />
      <PatienceMeter value={game.patience} />

      <ChatBox
        messages={game.messages}
        loading={game.loading}
        disabled={!playing || !game.sessionId}
        shopkeeperName={vendor.name}
        onSend={game.send}
        inputRef={inputRef}
      />
      <ActionBar
        price={game.currentPrice}
        disabled={!playing || game.loading || !game.sessionId}
        onAccept={game.accept}
        onWalkAway={game.walkAway}
        onQuick={game.send}
      />
    </aside>
  );
}
