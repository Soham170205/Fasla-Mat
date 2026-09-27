import { useState } from 'react';
import Home from './pages/Home';
import Market from './pages/Market';

function savedName() {
  try {
    return localStorage.getItem('fm-name') || '';
  } catch {
    return '';
  }
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [name, setName] = useState(savedName);

  const enter = n => {
    setName(n);
    try {
      localStorage.setItem('fm-name', n);
    } catch {
      /* private mode */
    }
    setScreen('market');
  };

  return screen === 'home' ? <Home initialName={name} onEnter={enter} /> : <Market playerName={name} onExit={() => setScreen('home')} />;
}
