// ===== UI：HUD、背包、菜单、聊天、调试 =====
import { B, BLOCKS, CREATIVE_ITEMS, blockInfo } from './blocks.js';
import { Save } from './save.js';

const $ = (id) => document.getElementById(id);

function pixelIcon(draw, w = 9, h = 9) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx);
  return c.toDataURL();
}

function heartIcon(kind) { // 'full' | 'half' | 'empty'
  return pixelIcon((ctx) => {
    const shape = [
      '.XX.XX.',
      'XXXXXXX',
      'XXXXXXX',
      'XXXXXXX',
      '.XXXXX.',
      '..XXX..',
      '...X...',
    ];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      if (shape[y][x] !== 'X') continue;
      let color = '#3b0a0a';
      if (kind === 'full' || (kind === 'half' && x < 4)) {
        color = (x === 1 && y === 1) ? '#ff8c8c' : '#e3313b';
      } else if (kind === 'empty') color = '#4a4a4a';
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillStyle = '#1a0505';
      ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y, 1, 1);
    }
  }, 9, 9);
}

function bubbleIcon() {
  return pixelIcon((ctx) => {
    ctx.strokeStyle = '#dff3ff';
    ctx.fillStyle = 'rgba(160,220,255,0.35)';
    ctx.beginPath(); ctx.arc(4.5, 4.5, 3.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(4.5, 4.5, 3.4, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 3, 1.4, 1.4);
  }, 9, 9);
}

export class UI {
  constructor(game) {
    this.game = game;
    this.cursorItem = null; // 背包操作中手上的物品
    this.icons = new Map();
    this.itemNameT = 0;
    this.toastT = 0;
    this.chatMode = false;
    this.bindButtons();
    this.buildHearts();
    this.buildBubbles();
    this.bindChat();
  }

  init(atlas) {
    this.atlas = atlas;
    for (const id of CREATIVE_ITEMS) this.icons.set(id, this.game.makeBlockIcon(id));
    this.refreshHotbar();
    $('splash').textContent = ['100%还原手感!', '小心苦力怕…没有苦力怕', '试试TNT!', '僵尸晚上出没!', '挖到钻石了吗?', '双击空格飞行!', '手机也能玩!'][(Math.random() * 7) | 0];
    // 标题屏泥土背景
    try {
      const idx = atlas.tileIndex.dirt;
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      c.getContext('2d').drawImage(atlas.canvas, (idx % atlas.cols) * 16, ((idx / atlas.cols) | 0) * 16, 16, 16, 0, 0, 16, 16);
      $('title-screen').style.backgroundImage = `url(${c.toDataURL()})`;
    } catch (e) { }
  }

  icon(id) {
    if (!this.icons.has(id)) this.icons.set(id, this.game.makeBlockIcon(id));
    return this.icons.get(id);
  }

  // ---------- 构建静态元素 ----------
  buildHearts() {
    this.heartImgs = { full: heartIcon('full'), half: heartIcon('half'), empty: heartIcon('empty') };
    const box = $('hearts');
    box.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const img = document.createElement('img');
      img.className = 'heart';
      img.src = this.heartImgs.full;
      box.appendChild(img);
    }
  }

  buildBubbles() {
    const bub = bubbleIcon();
    const box = $('bubbles');
    box.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const img = document.createElement('img');
      img.className = 'bubble';
      img.src = bub;
      box.appendChild(img);
    }
  }

  // ---------- 刷新 ----------
  refreshHotbar() {
    const p = this.game.player;
    if (!p) return;
    const bar = $('hotbar');
    if (bar.children.length !== 9) {
      bar.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.i = i;
        bar.appendChild(slot);
      }
    }
    for (let i = 0; i < 9; i++) {
      const slot = bar.children[i];
      const item = p.hotbar[i];
      slot.classList.toggle('sel', i === p.selected);
      slot.innerHTML = item
        ? `<img draggable="false" src="${this.icon(item.id)}">` + (item.count > 1 ? `<span class="count">${item.count}</span>` : '')
        : '';
      slot.onclick = () => { p.selected = i; this.refreshHotbar(); p.updateHeldMesh(true); };
    }
    if (this.invOpen()) this.renderInventory();
    const held = p.heldItem();
    if (held && this._lastHeld !== held.id + ':' + p.selected) {
      this._lastHeld = held.id + ':' + p.selected;
      this.showItemName(blockInfo(held.id).name);
    } else if (!held) this._lastHeld = null;
  }

  showItemName(name) {
    const el = $('item-name');
    el.textContent = name;
    el.style.opacity = 1;
    this.itemNameT = 1.6;
  }

  toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.style.opacity = 1;
    this.toastT = 2.2;
  }

  refreshVitals() {
    const p = this.game.player;
    if (!p) return;
    const hearts = $('hearts').children;
    const survival = p.mode === 'survival';
    $('hearts').style.display = survival ? 'flex' : 'none';
    for (let i = 0; i < 10; i++) {
      const v = p.hp - i * 2;
      hearts[i].src = v >= 2 ? this.heartImgs.full : v === 1 ? this.heartImgs.half : this.heartImgs.empty;
    }
    const bubbles = $('bubbles').children;
    $('bubbles').style.display = survival && p.headInWater ? 'flex' : 'none';
    for (let i = 0; i < 10; i++) bubbles[i].style.visibility = (i < Math.ceil(p.air)) ? 'visible' : 'hidden';
  }

  damageFlash() {
    const el = $('damage-overlay');
    el.style.opacity = 0.45;
    clearTimeout(this._df);
    this._df = setTimeout(() => { el.style.opacity = 0; }, 180);
  }

  tick(dt) {
    if (this.itemNameT > 0) {
      this.itemNameT -= dt;
      if (this.itemNameT <= 0) $('item-name').style.opacity = 0;
    }
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) $('toast').style.opacity = 0;
    }
  }

  // ---------- 调试 ----------
  updateDebug(fps) {
    const g = this.game;
    const p = g.player;
    if (!$('debug').classList.contains('show')) return;
    const pos = p.pos;
    const dirs = ['南 +Z', '西 -X', '北 -Z', '东 +X'];
    const d = ((Math.round(-p.yaw / (Math.PI / 2)) % 4) + 4) % 4;
    $('debug').innerHTML =
      `${fps.toFixed(0)} fps · ${g.world.chunks.size} 区块 · ${g.entities.list.length} 实体<br>` +
      `XYZ: ${pos.x.toFixed(1)} / ${pos.y.toFixed(1)} / ${pos.z.toFixed(1)}<br>` +
      `朝向: ${dirs[d]} · 俯仰 ${(p.pitch * 57.3).toFixed(0)}°<br>` +
      `群系: ${g.biomeName()} · 时间: ${g.clockStr()}<br>` +
      `模式: ${p.mode === 'creative' ? '创造' : '生存'}${p.flying ? ' · 飞行' : ''} · 种子: ${g.world.seed}`;
  }

  toggleDebug() { $('debug').classList.toggle('show'); }

  // ---------- 界面开关 ----------
  uiOpen() {
    return $('title-screen').style.display !== 'none'
      || $('pause-menu').style.display === 'flex'
      || $('inventory').style.display === 'flex'
      || $('death-screen').style.display === 'flex'
      || this.chatMode;
  }

  invOpen() { return $('inventory').style.display === 'flex'; }

  openPause() {
    $('pause-menu').style.display = 'flex';
    document.exitPointerLock && document.exitPointerLock();
    this.game.paused = true;
  }
  closePause() {
    $('pause-menu').style.display = 'none';
    this.game.paused = false;
    this.game.lockPointer();
  }

  openInventory() {
    if (this.game.player.mode !== 'creative' && !this.game.player.backpack.some(s => s) && !this.game.player.hotbar.some(s => s)) {
      this.toast('背包是空的，去挖点方块吧！');
      return;
    }
    $('inventory').style.display = 'flex';
    document.exitPointerLock && document.exitPointerLock();
    this.renderInventory();
  }

  closeInventory() {
    $('inventory').style.display = 'none';
    this.dropCursor();
    this.game.lockPointer();
  }

  // ---------- 背包渲染 ----------
  slotHTML(item, where, i, cls = '') {
    const inner = item
      ? `<img draggable="false" src="${this.icon(item.id)}">` + (item.count > 1 ? `<span class="count">${item.count}</span>` : '')
      : '';
    return `<div class="slot ${cls}" data-w="${where}" data-i="${i}">${inner}</div>`;
  }

  renderInventory() {
    const p = this.game.player;
    const creative = p.mode === 'creative';
    $('inv-title').textContent = creative ? '创造模式物品栏' : '背包';
    let html = '';
    if (creative) {
      html += '<div class="inv-grid" id="palette">';
      for (const id of CREATIVE_ITEMS) {
        html += `<div class="slot" data-w="pal" data-id="${id}"><img draggable="false" src="${this.icon(id)}"></div>`;
      }
      html += '</div>';
    } else {
      html += '<div class="inv-grid">';
      for (let i = 0; i < 27; i++) html += this.slotHTML(p.backpack[i], 'bp', i);
      html += '</div>';
    }
    html += '<div class="inv-sep"></div><div class="inv-grid">';
    for (let i = 0; i < 9; i++) html += this.slotHTML(p.hotbar[i], 'hb', i);
    html += '</div>';
    $('inv-body').innerHTML = html;
    $('inv-body').querySelectorAll('.slot').forEach(el => {
      el.onclick = (ev) => this.slotClick(ev.currentTarget, ev.button === 2);
      el.oncontextmenu = (ev) => { ev.preventDefault(); this.slotClick(ev.currentTarget, true); };
    });
    // 手上的物品光标跟随
    const cur = $('cursor-item');
    cur.style.display = this.cursorItem ? 'block' : 'none';
    if (this.cursorItem) cur.innerHTML = `<img draggable="false" src="${this.icon(this.cursorItem.id)}">` + (this.cursorItem.count > 1 ? `<span class="count">${this.cursorItem.count}</span>` : '');
  }

  slotClick(el, right) {
    const p = this.game.player;
    const w = el.dataset.w;
    if (w === 'pal') {
      const id = +el.dataset.id;
      this.cursorItem = { id, count: right ? 1 : 64 };
      this.renderInventory();
      return;
    }
    const arr = w === 'hb' ? p.hotbar : p.backpack;
    const i = +el.dataset.i;
    const cur = arr[i];
    if (this.cursorItem) {
      if (!cur) {
        if (right) { arr[i] = { id: this.cursorItem.id, count: 1 }; if (--this.cursorItem.count <= 0) this.cursorItem = null; }
        else { arr[i] = this.cursorItem; this.cursorItem = null; }
      } else if (cur.id === this.cursorItem.id) {
        const add = right ? 1 : Math.min(64 - cur.count, this.cursorItem.count);
        cur.count += add;
        this.cursorItem.count -= add;
        if (this.cursorItem.count <= 0) this.cursorItem = null;
      } else {
        arr[i] = this.cursorItem;
        this.cursorItem = cur;
      }
    } else if (cur) {
      if (right && cur.count > 1) {
        this.cursorItem = { id: cur.id, count: Math.ceil(cur.count / 2) };
        cur.count -= this.cursorItem.count;
      } else { this.cursorItem = cur; arr[i] = null; }
    }
    this.refreshHotbar();
    this.renderInventory();
  }

  dropCursor() {
    if (!this.cursorItem) return;
    const g = this.game;
    const d = g.entities.spawnDrop(this.cursorItem.id, g.player.pos.x, g.player.pos.y + 1.2, g.player.pos.z);
    if (d) d.pickupDelay = 1.5;
    this.cursorItem = null;
    $('cursor-item').style.display = 'none';
  }

  // ---------- 死亡 ----------
  showDeath(cause) {
    $('death-cause').textContent = cause ? `死因：${cause}` : '';
    $('death-screen').style.display = 'flex';
    document.exitPointerLock && document.exitPointerLock();
  }

  // ---------- 聊天命令 ----------
  bindChat() {
    const input = $('chat-input');
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        this.runCommand(input.value.trim());
        input.value = '';
        this.closeChat();
      } else if (e.key === 'Escape') this.closeChat();
    });
  }

  openChat(prefill) {
    this.chatMode = true;
    $('chat-bar').style.display = 'flex';
    const input = $('chat-input');
    input.value = prefill || '';
    setTimeout(() => input.focus(), 30);
    document.exitPointerLock && document.exitPointerLock();
  }

  closeChat() {
    this.chatMode = false;
    $('chat-bar').style.display = 'none';
    this.game.lockPointer();
  }

  runCommand(text) {
    if (!text) return;
    const g = this.game;
    const p = g.player;
    if (!text.startsWith('/')) { this.toast(`<你> ${text}`); return; }
    const [cmd, ...args] = text.slice(1).split(/\s+/);
    if (cmd === 'time' && args[0] === 'set') {
      if (args[1] === 'day') { g.sky.timeOfDay = 0.06; this.toast('时间 → 白天'); }
      else if (args[1] === 'night') { g.sky.timeOfDay = 0.56; this.toast('时间 → 夜晚'); }
      else if (args[1] === 'noon') { g.sky.timeOfDay = 0.25; this.toast('时间 → 正午'); }
      else if (!isNaN(+args[1])) { g.sky.timeOfDay = ((+args[1] / 600) % 1 + 1) % 1; this.toast('时间已设置'); }
    } else if (cmd === 'gamemode') {
      const m = args[0];
      if (m === 'c' || m === 'creative') { p.mode = 'creative'; this.toast('游戏模式 → 创造'); }
      else if (m === 's' || m === 'survival') { p.mode = 'survival'; p.flying = false; this.toast('游戏模式 → 生存'); }
      this.refreshVitals();
      this.refreshHotbar();
    } else if (cmd === 'tp') {
      const [x, y, z] = args.map(Number);
      if ([x, y, z].every(v => !isNaN(v))) {
        p.pos = { x, y, z };
        this.toast(`已传送到 ${x} ${y} ${z}`);
      }
    } else if (cmd === 'kill') {
      p.damageCd = 0; p.damage(999, '自尽');
    } else if (cmd === 'help') {
      this.toast('/time set day|night · /gamemode c|s · /tp x y z · /kill');
    } else this.toast('未知命令，输入 /help 查看');
  }

  // ---------- 按钮绑定 ----------
  bindButtons() {
    const g = this.game;
    $('btn-survival').onclick = () => g.startGame('survival');
    $('btn-creative').onclick = () => g.startGame('creative');
    $('btn-continue').onclick = () => {
      const save = Save.load();
      g.startGame(save ? (save.player.mode || 'survival') : 'survival', true);
    };
    $('btn-help').onclick = () => { $('help-panel').style.display = 'flex'; };
    $('help-close').onclick = () => { $('help-panel').style.display = 'none'; };
    $('btn-resume').onclick = () => this.closePause();
    $('btn-pause-help').onclick = () => { $('help-panel').style.display = 'flex'; };
    $('btn-mode').onclick = () => {
      const p = g.player;
      p.mode = p.mode === 'creative' ? 'survival' : 'creative';
      if (p.mode === 'survival') p.flying = false;
      $('btn-mode').textContent = `模式：${p.mode === 'creative' ? '创造' : '生存'}`;
      document.body.classList.toggle('creative-touch', p.mode === 'creative');
      this.toast(`已切换到${p.mode === 'creative' ? '创造' : '生存'}模式`);
      this.refreshVitals();
    };
    $('btn-newworld').onclick = () => {
      if (!this.game.newWorldConfirm) {
        this.game.newWorldConfirm = true;
        $('btn-newworld').textContent = '再点一次确认重置';
        setTimeout(() => { this.game.newWorldConfirm = false; $('btn-newworld').textContent = '重置世界（新存档）'; }, 2500);
      } else {
        this.game.newWorldConfirm = false;
        $('btn-newworld').textContent = '重置世界（新存档）';
        $('pause-menu').style.display = 'none';
        this.game.paused = false;
        Save.clear();
        g.startGame(g.player.mode, false);
      }
    };
    $('btn-respawn').onclick = () => {
      $('death-screen').style.display = 'none';
      g.player.respawn();
      g.lockPointer();
    };
    document.addEventListener('mousemove', (e) => {
      if (this.cursorItem) {
        const cur = $('cursor-item');
        cur.style.left = e.clientX + 4 + 'px';
        cur.style.top = e.clientY + 4 + 'px';
      }
    });
  }
}
