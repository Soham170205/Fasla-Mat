import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './state/auth';
import Home from './pages/Home';
import Market from './pages/Market';
import { startMusic, installUnlock } from './audio/sound';

function Screens() {
  const { user } = useAuth();
  const [screen, setScreen] = useState('home');
  const [guestName, setGuestName] = useState('Grahak');

  const enter = name => {
    if (name) setGuestName(name);
    setScreen('market');
  };

  return screen === 'home' ? (
    <Home onEnter={enter} />
  ) : (
    <Market playerName={user?.displayName || guestName} onExit={() => setScreen('home')} />
  );
}

export default function App() {
  // background music plays on every screen; browsers start it after the first click or key press
  useEffect(() => {
    const removeUnlock = installUnlock();
    startMusic();
    return removeUnlock;
  }, []);

  return (
    <AuthProvider>
      <Screens />
    </AuthProvider>
  );
}
