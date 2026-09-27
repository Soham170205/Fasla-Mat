import Phaser from 'phaser';

// Phaser <-> React messages.
// scene emits: 'near' ({kind,id,name}|null), 'talk' (vendorId), 'talkNpc' (npcId)
// React emits: 'resume', 'requestTalk' ({kind,id}), 'sold' (vendorId), 'mood' (vendorId, mood), 'cooldown' (vendorId, ms)
export const bus = new Phaser.Events.EventEmitter();
