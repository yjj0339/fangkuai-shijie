// ===== 触屏控件：虚拟摇杆 + 视角拖动 + 点放长挖 =====
const $ = (id) => document.getElementById(id);
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export class Touch {
  constructor(game) {
    this.game = game;
    this.joyId = null; this.lookId = null;
    this.joyBase = { x: 0, y: 0 };
    this.joyVec = { x: 0, y: 0 };
    this.lookLast = { x: 0, y: 0 };
    this.tapStart = 0; this.tapMoved = 0;
    this.miningHold = false;
    if (!isTouchDevice()) return;
    document.body.classList.add('touch');
    this.bind();
  }

  static get isTouch() { return isTouchDevice(); }

  bind() {
    const g = this.game;
    const joy = $('joy');
    const knob = $('joy-knob');
    const area = document.getElementById('game-canvas-wrap') || document.body;

    const joyRect = () => joy.getBoundingClientRect();

    // 摇杆
    joy.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.joyId !== null) return;
      const t = e.changedTouches[0];
      this.joyId = t.identifier;
      const r = joyRect();
      this.joyBase = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { passive: false });

    // 视角区域 = 屏幕右半
    area.addEventListener('touchstart', (e) => {
      if (g.ui.uiOpen()) return;
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.42) continue;
        if (t.target.closest && t.target.closest('.tbtn, #hotbar, .btn, #jump-btn')) continue;
        if (this.lookId !== null) continue;
        this.lookId = t.identifier;
        this.lookLast = { x: t.clientX, y: t.clientY };
        this.tapStart = performance.now();
        this.tapMoved = 0;
      }
    }, { passive: true });

    area.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          const dx = t.clientX - this.joyBase.x, dy = t.clientY - this.joyBase.y;
          const max = 52;
          const len = Math.min(max, Math.hypot(dx, dy));
          const a = Math.atan2(dy, dx);
          this.joyVec = { x: Math.cos(a) * len / max, y: Math.sin(a) * len / max };
          knob.style.transform = `translate(${Math.cos(a) * len}px, ${Math.sin(a) * len}px)`;
        } else if (t.identifier === this.lookId) {
          const dx = t.clientX - this.lookLast.x, dy = t.clientY - this.lookLast.y;
          this.lookLast = { x: t.clientX, y: t.clientY };
          this.tapMoved += Math.abs(dx) + Math.abs(dy);
          const p = g.player;
          p.yaw -= dx * 0.006;
          p.pitch -= dy * 0.006;
          p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch));
        }
      }
    }, { passive: true });

    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          this.joyId = null;
          this.joyVec = { x: 0, y: 0 };
          knob.style.transform = 'translate(0,0)';
        } else if (t.identifier === this.lookId) {
          this.lookId = null;
          // 短点按 → 放置
          if (performance.now() - this.tapStart < 240 && this.tapMoved < 14 && !this.miningHold) {
            g.interact.mouseR = true;
            setTimeout(() => { g.interact.mouseR = false; }, 60);
          }
          this.miningHold = false;
          g.interact.mouseL = false;
        }
      }
    };
    area.addEventListener('touchend', endTouch);
    area.addEventListener('touchcancel', endTouch);

    // 长按挖掘
    let holdTimer = null;
    area.addEventListener('touchstart', (e) => {
      if (g.ui.uiOpen()) return;
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.42) continue;
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
          if (this.lookId === t.identifier) { this.miningHold = true; g.interact.mouseL = true; }
        }, 320);
      }
    }, { passive: true });
    area.addEventListener('touchend', () => { if (holdTimer) clearTimeout(holdTimer); }, { passive: true });

    // 按钮
    const bindBtn = (id, down, up) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); up && up(); }, { passive: false });
    };
    bindBtn('jump-btn', () => g.player.keys.add('Space'), () => g.player.keys.delete('Space'));
    bindBtn('sneak-btn', () => {
      const p = g.player;
      if (p.flying) p.keys.add('ShiftLeft'); else p.sneak = !p.sneak;
      if (!p.flying) document.getElementById('sneak-btn').classList.toggle('on', p.sneak);
    }, () => g.player.keys.delete('ShiftLeft'));
    bindBtn('fly-up-btn', () => g.player.keys.add('Space'), () => g.player.keys.delete('Space'));
    bindBtn('fly-down-btn', () => g.player.keys.add('ShiftLeft'), () => g.player.keys.delete('ShiftLeft'));
    bindBtn('fly-toggle-btn', () => {
      const p = g.player;
      if (p.mode === 'creative') { p.flying = !p.flying; p.vel.y = 0; g.ui.toast(p.flying ? '飞行：开' : '飞行：关'); }
    });
    bindBtn('inv-btn', () => {
      if (g.ui.invOpen()) g.ui.closeInventory(); else g.ui.openInventory();
    });
    bindBtn('pause-btn', () => g.ui.openPause());
    bindBtn('debug-btn', () => g.ui.toggleDebug());

    // 屏幕锁定竖屏时提示可横屏
  }

  // 摇杆 → 玩家移动（每帧）
  applyMove() {
    const g = this.game;
    if (!document.body.classList.contains('touch')) return;
    const p = g.player;
    if (this.joyVec.x || this.joyVec.y) {
      const mag = Math.hypot(this.joyVec.x, this.joyVec.y);
      const nx = this.joyVec.x / (mag || 1), ny = this.joyVec.y / (mag || 1);
      // 前进 = -y 摇杆方向
      p.keys.add('KeyW');
      if (mag > 0.92 && ny < -0.7) p.sprint = true;
      this.moveVec = { x: nx, y: ny, mag };
    } else {
      if (!p.keys.has('KeyS') && !p.keys.has('KeyA') && !p.keys.has('KeyD')) p.keys.delete('KeyW');
      this.moveVec = null;
    }
  }

  // 把摇杆向量转成 WASD 注入（在 player.update 前调用）
  overrideInput() {
    const g = this.game;
    if (!this.moveVec) return;
    const p = g.player;
    // 直接设置虚拟 mx/mz：模拟按 W + A/D 组合
    const v = this.moveVec;
    p.keys.delete('KeyA'); p.keys.delete('KeyD');
    const ang = Math.atan2(v.x, -v.y); // 0=前
    if (Math.abs(ang) < Math.PI * 0.25) { /* 纯 W */ }
    else if (ang > 0 && ang < Math.PI * 0.75) p.keys.add('KeyD');
    else if (ang < 0 && ang > -Math.PI * 0.75) p.keys.add('KeyA');
    else p.keys.delete('KeyW');
    if (v.mag < 0.45) { p.sneak = true; } else if (!this.sneakLatch) p.sneak = p.keys.has('ShiftLeft');
  }
}
