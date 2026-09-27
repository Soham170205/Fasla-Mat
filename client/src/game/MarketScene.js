import Phaser from 'phaser';
import layout from './mapLayout.json';
import { bus } from './bus';

const DIRS = ['down', 'left', 'right', 'up'];
const SPRITES = ['field_farmer', 'herb_keeper', 'forge_worker', 'road_merchant', 'shopper_teal', 'shopper_red'];
const PLAYER = 'road_merchant';
const FONT = '"Pixelify Sans", monospace';
const SPEED = 90;          // world px per second
const TALK_RADIUS = 36;
const FEET = 30 / 32;      // NPC pack pivot is pixel (16, 30)
const MOOD_EMOJI = { happy: '😄', neutral: '🙂', annoyed: '😒', angry: '😡' };

export default class MarketScene extends Phaser.Scene {
  constructor() {
    super('market');
  }

  init(data) {
    this.vendors = data.vendors || [];
    this.vendorOfDay = data.vendorOfDay;
  }

  preload() {
    this.load.image('ground', '/assets/ground.png');
    this.load.atlas('props', '/assets/atlas.png', '/assets/atlas.json');
    for (const s of SPRITES) {
      this.load.spritesheet(`${s}_idle`, `/assets/npc/${s}_idle.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`${s}_walk`, `/assets/npc/${s}_walk.png`, { frameWidth: 32, frameHeight: 32 });
    }
  }

  create() {
    const W = layout.cols * layout.tile;
    const H = layout.rows * layout.tile;
    this.physics.world.setBounds(0, 0, W, H);
    this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-1000);
    this.makeAnims();

    this.solids = [];
    for (const o of layout.objects) {
      const img = this.add.image(o.x, o.y, 'props', o.frame).setOrigin(0.5, 1).setDepth(o.y);
      if (o.collide) {
        this.shadow(o.x, o.y - 2, Math.min(o.collide[0] + 6, img.width));
        this.addSolid(o.x, o.y - o.collide[1] / 2, o.collide[0], o.collide[1]);
      }
    }
    for (const b of layout.blockers) this.addSolid(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h);

    this.createVendors();
    this.createCrowd();

    // player
    const { x, y } = layout.spawn;
    this.playerShadow = this.shadow(x, y, 22);
    this.player = this.physics.add.sprite(x, y, `${PLAYER}_idle`).setOrigin(0.5, FEET).setScale(2);
    this.player.body.setSize(12, 6).setOffset(10, 24);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.solids);
    this.facing = 'up';

    this.cameras.main.setBounds(0, 0, W, H).startFollow(this.player, true, 0.12, 0.12);
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.fitCamera, this));

    // false = don't capture keys, so typing in the React chat input still works
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER', false);
    this.frozen = false;
    this.nearId = null;
    this.target = null;
    this.autoTalk = null;
    this.stuckMs = 0;

    this.input.on('pointerdown', p => this.onTap(p));
    this.time.addEvent({ delay: 3200, loop: true, callback: () => this.randomCallout() });

    const handlers = {
      resume: () => this.resume(),
      requestTalk: id => { if (!this.frozen) this.talk(id); },
      sold: id => this.markSold(id),
      mood: (id, mood) => this.showMood(id, mood),
      cooldown: (id, ms) => this.setCooldown(id, ms)
    };
    Object.entries(handlers).forEach(([evt, fn]) => bus.on(evt, fn));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      Object.entries(handlers).forEach(([evt, fn]) => bus.off(evt, fn));
    });
  }

  // Zoom in half steps so pixels stay chunky on any screen, from phones to projectors
  fitCamera() {
    const { width, height } = this.scale.gameSize;
    const zoom = Phaser.Math.Clamp(Math.round(Math.min(width / 480, height / 300) * 2) / 2, 1.5, 3);
    this.cameras.main.setSize(width, height).setZoom(zoom);
  }

  // ------------------------------------------------------------ helpers
  makeAnims() {
    for (const s of SPRITES) {
      DIRS.forEach((d, row) => {
        const idle = `${s}_idle_${d}`;
        const walk = `${s}_walk_${d}`;
        if (!this.anims.exists(idle)) {
          this.anims.create({
            key: idle,
            frames: this.anims.generateFrameNumbers(`${s}_idle`, { start: row * 4, end: row * 4 + 3 }),
            frameRate: 4,
            repeat: -1
          });
        }
        if (!this.anims.exists(walk)) {
          this.anims.create({
            key: walk,
            frames: this.anims.generateFrameNumbers(`${s}_walk`, { start: row * 6, end: row * 6 + 5 }),
            frameRate: 8,
            repeat: -1
          });
        }
      });
    }
  }

  addSolid(x, y, w, h) {
    const z = this.add.zone(x, y, w, h);
    this.physics.add.existing(z, true);
    this.solids.push(z);
    return z;
  }

  shadow(x, y, w) {
    return this.add.ellipse(x, y, w, Math.max(4, w * 0.32), 0x120a06, 0.28).setDepth(-500);
  }

  label(x, y, text, style = {}) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#fdf6e3',
        backgroundColor: '#2a1b12d9',
        padding: { x: 3, y: 1 },
        resolution: 4,
        ...style
      })
      .setOrigin(0.5, 1)
      .setDepth(5000);
    t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return t;
  }

  // ------------------------------------------------------------ vendors
  createVendors() {
    this.stalls = {};
    for (const v of this.vendors) {
      const p = layout.vendors[v.id];
      if (!p) continue;
      if (v.id === this.vendorOfDay) {
        const glow = this.add.ellipse(p.x, p.y, 46, 16, 0xf2b233, 0.55).setDepth(-600);
        this.tweens.add({ targets: glow, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
      }
      this.shadow(p.x, p.y, 22);
      const sprite = this.add
        .sprite(p.x, p.y, `${v.sprite}_idle`)
        .setOrigin(0.5, FEET)
        .setScale(2)
        .setDepth(p.y)
        .play({ key: `${v.sprite}_idle_down`, startFrame: Phaser.Math.Between(0, 3) });
      this.addSolid(p.x, p.y - 4, 20, 10);
      const name = this.label(p.x, p.y - 58, v.name);
      if (v.id === this.vendorOfDay) {
        const badge = this.label(p.x, p.y - 70, 'Aaj ka special', { color: '#2a1b12', backgroundColor: '#f2b233' });
        this.tweens.add({ targets: badge, y: p.y - 72, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      this.stalls[v.id] = { v, x: p.x, y: p.y, talkX: p.x, talkY: p.y + 24, sprite, name, bubble: null, sold: false, cooldownUntil: 0 };
    }
  }

  createCrowd() {
    this.crowd = [];
    for (const c of layout.crowd || []) {
      const dirTo = c.to > c.from ? 'right' : 'left';
      const dirBack = dirTo === 'right' ? 'left' : 'right';
      const shadow = this.shadow(c.from, c.y, 20);
      const s = this.add.sprite(c.from, c.y, `${c.sprite}_walk`).setOrigin(0.5, FEET).setScale(2).setDepth(c.y);
      s.play(`${c.sprite}_walk_${dirTo}`);
      this.tweens.add({
        targets: s,
        x: c.to,
        duration: c.duration,
        yoyo: true,
        repeat: -1,
        hold: 800,
        repeatDelay: 800,
        onYoyo: () => s.play(`${c.sprite}_walk_${dirBack}`),
        onRepeat: () => s.play(`${c.sprite}_walk_${dirTo}`)
      });
      this.crowd.push({ s, shadow });
    }
  }

  bubble(stall, text, ms = 2400, style = {}) {
    if (stall.bubble) stall.bubble.destroy();
    stall.bubble = this.label(stall.x, stall.y - 70, text, {
      color: '#2a1b12',
      backgroundColor: '#fdf6e3',
      wordWrap: { width: 110 },
      align: 'center',
      ...style
    }).setDepth(6000);
    const b = stall.bubble;
    this.time.delayedCall(ms, () => {
      b.destroy();
      if (stall.bubble === b) stall.bubble = null;
    });
  }

  randomCallout() {
    const list = Object.values(this.stalls).filter(s => !s.sold && !s.bubble && s.v.id !== this.talkingTo);
    if (!list.length) return;
    const s = Phaser.Utils.Array.GetRandom(list);
    this.bubble(s, Phaser.Utils.Array.GetRandom(s.v.callouts));
  }

  showMood(id, mood) {
    const s = this.stalls[id];
    if (s && MOOD_EMOJI[mood]) this.bubble(s, MOOD_EMOJI[mood], 1800, { fontSize: '12px', backgroundColor: '#00000000' });
  }

  markSold(id) {
    const s = this.stalls[id];
    if (!s || s.sold) return;
    s.sold = true;
    const stamp = this.label(s.x + 68, s.y - 26, 'BIK GAYA', {
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#fdf6e3',
      backgroundColor: '#4f7c3a',
      padding: { x: 4, y: 2 }
    }).setAngle(-10).setScale(1.6).setAlpha(0);
    this.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 260, ease: 'Back.out' });
  }

  setCooldown(id, ms) {
    const s = this.stalls[id];
    if (!s) return;
    s.cooldownUntil = this.time.now + ms;
    this.showMood(id, 'angry');
  }

  // ------------------------------------------------------------ input
  onTap(p) {
    if (this.frozen) return;
    let tappedVendor = null;
    for (const s of Object.values(this.stalls)) {
      if (Phaser.Math.Distance.Between(p.worldX, p.worldY, s.x, s.y - 24) < 30) tappedVendor = s;
    }
    if (tappedVendor) {
      this.target = new Phaser.Math.Vector2(tappedVendor.talkX, tappedVendor.talkY);
      this.autoTalk = tappedVendor.v.id;
    } else {
      this.target = new Phaser.Math.Vector2(p.worldX, p.worldY);
      this.autoTalk = null;
    }
    this.stuckMs = 0;
  }

  talk(id) {
    const s = this.stalls[id];
    this.autoTalk = null;
    this.target = null;
    if (!s) return;
    if (s.sold) return this.bubble(s, 'Maal khatam! Kal aana.');
    if (this.time.now < s.cooldownUntil) return this.bubble(s, 'Abhi nahi! Baad mein aana.');
    this.frozen = true;
    this.talkingTo = id;
    this.input.keyboard.enabled = false;
    this.player.body.setVelocity(0, 0);
    this.facing = 'up';
    this.player.anims.play(`${PLAYER}_idle_up`, true);
    this.nearId = null;
    bus.emit('near', null);
    bus.emit('talk', id);
  }

  resume() {
    this.frozen = false;
    this.talkingTo = null;
    this.input.keyboard.enabled = true;
    this.input.keyboard.resetKeys();
  }

  // ------------------------------------------------------------ loop
  update(time, delta) {
    for (const c of this.crowd) {
      c.shadow.setPosition(c.s.x, c.s.y);
    }
    const body = this.player.body;
    if (this.frozen) {
      body.setVelocity(0, 0);
      this.playerShadow.setPosition(this.player.x, this.player.y);
      return;
    }

    const k = this.keys;
    let dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    let dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);

    if (dx || dy) {
      this.target = null;
      this.autoTalk = null;
    } else if (this.target) {
      const vx = this.target.x - this.player.x;
      const vy = this.target.y - this.player.y;
      const dist = Math.hypot(vx, vy);
      if (dist < 3) {
        this.target = null;
      } else {
        dx = vx / dist;
        dy = vy / dist;
      }
    }

    const vel = new Phaser.Math.Vector2(dx, dy);
    const moving = vel.lengthSq() > 0;
    if (moving) vel.normalize().scale(SPEED);
    body.setVelocity(vel.x, vel.y);

    // give up on tap-to-move if something is in the way
    if (this.target && this.lastPos) {
      const moved = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.lastPos.x, this.lastPos.y);
      this.stuckMs = moved < 0.2 ? this.stuckMs + delta : 0;
      if (this.stuckMs > 350) {
        this.target = null;
        this.stuckMs = 0;
      }
    }
    this.lastPos = { x: this.player.x, y: this.player.y };

    if (moving) {
      this.facing = Math.abs(vel.x) > Math.abs(vel.y) ? (vel.x > 0 ? 'right' : 'left') : vel.y > 0 ? 'down' : 'up';
    }
    this.player.anims.play(`${PLAYER}_${moving ? 'walk' : 'idle'}_${this.facing}`, true);
    this.player.setDepth(this.player.y);
    this.playerShadow.setPosition(this.player.x, this.player.y);

    // who is close enough to talk to?
    let near = null;
    let best = TALK_RADIUS;
    for (const s of Object.values(this.stalls)) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.talkX, s.talkY);
      if (d < best) {
        best = d;
        near = s;
      }
    }
    const nearId = near ? near.v.id : null;
    if (nearId !== this.nearId) {
      this.nearId = nearId;
      bus.emit('near', nearId);
    }

    const pressed =
      Phaser.Input.Keyboard.JustDown(k.E) || Phaser.Input.Keyboard.JustDown(k.SPACE) || Phaser.Input.Keyboard.JustDown(k.ENTER);
    if (near && (pressed || this.autoTalk === near.v.id)) this.talk(near.v.id);
  }
}
