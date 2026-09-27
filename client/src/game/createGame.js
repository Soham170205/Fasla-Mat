import Phaser from 'phaser';
import MarketScene from './MarketScene';

export async function createGame(parent, data) {
  try {
    await document.fonts.load('8px "Pixelify Sans"');
  } catch {
    /* fall back to monospace */
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth || 960,
    height: parent.clientHeight || 640,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#17202b',
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: { mode: Phaser.Scale.RESIZE }
  });
  game.scene.add('market', MarketScene, true, data);
  return game;
}
