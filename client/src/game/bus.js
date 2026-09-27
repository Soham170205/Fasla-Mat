import Phaser from 'phaser';

// Phaser <-> React messages.
// scene emits: 'near' (vendorId|null), 'talk' (vendorId)
// React emits: 'resume', 'requestTalk' (vendorId), 'sold' (vendorId), 'mood' (vendorId, mood), 'cooldown' (vendorId, ms)
export const bus = new Phaser.Events.EventEmitter();
