// ===== 游戏主控：渲染、区块调度、输入、流程 =====
import * as THREE from '../vendor/three.module.js';
import { World, BIOME_NAMES, WH } from './world.js';
import { createAtlas, makeBlockIcon, createSkins, createSkyTextures } from './textures.js';
import { createChunkMaterials, buildChunkMeshes, disposeChunkMeshes } from './mesher.js';
import { Player } from './player.js';
import { Interact } from './interact.js';
import { Entities, initSkins } from './entities.js';
import { Sky } from './sky.js';
import { Sound } from './sound.js';
import { UI } from './ui.js';
import { Touch } from './touch.js';
import { Save } from './save.js';
import { B, blockInfo } from './blocks.js';
import { hash2 } from './math.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.state = 'title';   // title | loading | playing
    this.paused = false;
    this.shake = 0;
    this.viewDist = Touch.isTouch ? 5 : 6;
    this.saveT = 0;
    this.newWorldConfirm = false;
    this.worldReady = false;

    const canvas = $('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 900);
    this.scene.add(this.camera);

    // 资源
    this.atlas = createAtlas();
    this.materials = createChunkMaterials(this.atlas);
    this.sky = new Sky(this.scene, createSkyTextures());
    this.sky.setViewDist(this.viewDist);
    this.sound = new Sound();
    initSkins(createSkins());

    // 子系统（player/world 在 startGame 时创建）
    this.ui = new UI(this);
    this.ui.init(this.atlas);
    this.entities = new Entities(this);
    this.touch = new Touch(this);
    this.player = new Player(this);
    this.interact = new Interact(this);

    // 按存档存在性调整标题按钮
    if (Save.exists()) $('btn-continue').style.display = 'block';
    else $('btn-continue').style.display = 'none';

    this.bindInput();
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    addEventListener('beforeunload', () => { if (this.state === 'playing') Save.save(this); });

    this.meshCache = new Map(); // key → meshes
    this.lastT = performance.now();
    this.fpsAcc = 0; this.fpsN = 0; this.fps = 60;
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------- 开始 ----------
  startGame(mode, fromSave = false) {
    if (this.state === 'loading') return; // 防止连点重复初始化
    this.sound.resume();
    const save = fromSave ? Save.load() : null;
    const seed = save ? save.seed : (Math.random() * 0x7fffffff) | 0;
    if (!fromSave) Save.clear();

    // 清理旧世界
    for (const meshes of this.meshCache.values()) disposeChunkMeshes(meshes);
    this.meshCache.clear();
    this.entities.clear();

    this.world = new World(seed);
    if (save) for (const [k, v] of save.edits) this.world.edits.set(k, v);

    this.player = new Player(this);
    this.player.mode = save ? save.player.mode : mode;
    const spawn = this.world.findSpawn();
    this.player.spawn = spawn;
    if (save) {
      const sp = save.player;
      this.player.pos = sp.pos; this.player.yaw = sp.yaw; this.player.pitch = sp.pitch;
      this.player.hp = sp.hp; this.player.hotbar = sp.hotbar; this.player.backpack = sp.backpack;
      this.player.selected = sp.selected || 0;
      this.player.spawn = sp.spawn || spawn;
    } else {
      this.player.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
    }
    this.interact = new Interact(this);

    this.sky.timeOfDay = save ? (save.time ?? 0.1) : 0.08;

    $('title-screen').style.display = 'none';
    $('hud').style.display = 'block';
    $('loading').style.display = 'flex';
    document.body.classList.toggle('creative-touch', this.player.mode === 'creative');
    this.state = 'loading';
    this.worldReady = false;
    this.loadTotal = Math.pow(5, 2) + Math.pow(3, 2);
    this.ui.refreshHotbar();
    this.ui.refreshVitals();
    $('btn-mode').textContent = `模式：${this.player.mode === 'creative' ? '创造' : '生存'}`;
  }

  // ---------- 区块调度 ----------
  chunkTick(budgetGen, budgetMesh) {
    const w = this.world;
    if (!w) return;
    const pcx = Math.floor(this.player.pos.x) >> 4;
    const pcz = Math.floor(this.player.pos.z) >> 4;
    const R = this.viewDist;

    // 1) 生成缺失数据（近→远）
    let genBudget = budgetGen;
    outer:
    for (let r = 0; r <= R && genBudget > 0; r++) {
      for (let dz = -r; dz <= r && genBudget > 0; dz++) {
        for (let dx = -r; dx <= r && genBudget > 0; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = pcx + dx, cz = pcz + dz;
          if (!w.chunks.has(w.key(cx, cz))) {
            w.generateChunk(cx, cz);
            genBudget--;
          }
        }
      }
    }

    // 2) 玩家修改导致的重建（高优先，立即）
    let dirtyBudget = 8;
    for (const key of w.dirtyQueue) {
      if (dirtyBudget-- <= 0) break;
      w.dirtyQueue.delete(key);
      this.rebuildChunk(key);
    }

    // 3) 新区块建网格（近→远，需 4 邻数据）
    let meshBudget = budgetMesh;
    outer:
    for (let r = 0; r <= R && meshBudget > 0; r++) {
      for (let dz = -r; dz <= r && meshBudget > 0; dz++) {
        for (let dx = -r; dx <= r && meshBudget > 0; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = pcx + dx, cz = pcz + dz;
          const key = w.key(cx, cz);
          const c = w.chunks.get(key);
          if (c && c.dirty && !this.meshCache.has(key) && this.neighborsReady(cx, cz)) {
            this.buildChunk(cx, cz);
            meshBudget--;
          }
        }
      }
    }

    // 4) 卸载远处
    if ((this._unloadT = (this._unloadT || 0) + 1) % 120 === 0) {
      for (const [key, meshes] of this.meshCache) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > R + 2) {
          disposeChunkMeshes(meshes);
          this.meshCache.delete(key);
          const c = w.chunks.get(key);
          if (c) { c.dirty = true; c.meshes = null; }
        }
      }
      for (const key of w.chunks.keys()) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > R + 3) w.chunks.delete(key);
      }
    }
  }

  neighborsReady(cx, cz) {
    const w = this.world;
    return w.chunks.has(w.key(cx + 1, cz)) && w.chunks.has(w.key(cx - 1, cz)) &&
      w.chunks.has(w.key(cx, cz + 1)) && w.chunks.has(w.key(cx, cz - 1));
  }

  buildChunk(cx, cz) {
    const w = this.world;
    const key = w.key(cx, cz);
    const old = this.meshCache.get(key);
    if (old) disposeChunkMeshes(old);
    const meshes = buildChunkMeshes(w, this.atlas, this.materials, cx, cz);
    const list = [meshes.opaque, meshes.cutout, meshes.water].filter(Boolean);
    for (const m of list) this.scene.add(m);
    this.meshCache.set(key, list);
    w.chunks.get(key).dirty = false;
  }

  rebuildChunk(key) {
    if (!this.meshCache.has(key)) return;
    const [cx, cz] = key.split(',').map(Number);
    this.buildChunk(cx, cz);
  }

  // ---------- 输入 ----------
  lockPointer() {
    if (Touch.isTouch) return;
    if (this.state === 'playing' && !this.ui.uiOpen()) {
      $('game-canvas').requestPointerLock && $('game-canvas').requestPointerLock();
    }
  }

  bindInput() {
    const canvas = $('game-canvas');
    canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !this.ui.uiOpen()) this.lockPointer();
    });

    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'playing' && !this.ui.uiOpen()) {
        this.ui.openPause();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement && this.state === 'playing') {
        const p = this.player;
        p.yaw -= e.movementX * 0.0023;
        p.pitch -= e.movementY * 0.0023;
        p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch));
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing' || this.ui.uiOpen()) return;
      if (!document.pointerLockElement && !Touch.isTouch) return;
      if (e.button === 0) { this.interact.mouseL = true; this.player.swing(); }
      else if (e.button === 1) { this.interact.pickBlock(); e.preventDefault(); }
      else if (e.button === 2) { this.interact.mouseR = true; this.interact.placeBlock(); }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.interact.mouseL = false;
      else if (e.button === 2) this.interact.mouseR = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => {
      if (this.state !== 'playing' || this.ui.uiOpen()) return;
      const p = this.player;
      p.selected = (p.selected + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      this.ui.refreshHotbar();
      p.updateHeldMesh(true);
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (this.state !== 'playing') return;
      // 全局键
      if (e.code === 'F3') { e.preventDefault(); this.ui.toggleDebug(); return; }
      if (e.code === 'Slash' && !this.ui.chatMode && !this.ui.uiOpen()) {
        this.ui.openChat('/'); e.preventDefault(); return;
      }
      if (e.code === 'KeyT' && !this.ui.chatMode && !this.ui.uiOpen()) {
        this.ui.openChat(''); e.preventDefault(); return;
      }
      if (e.code === 'Escape') {
        if (this.ui.chatMode) { this.ui.closeChat(); return; }
        if (this.ui.invOpen()) { this.ui.closeInventory(); return; }
        if ($('pause-menu').style.display === 'flex') { this.ui.closePause(); return; }
        if ($('help-panel').style.display === 'flex') { $('help-panel').style.display = 'none'; return; }
        this.ui.openPause(); return;
      }
      if (e.code === 'KeyE' && !this.ui.chatMode) {
        if (this.ui.invOpen()) this.ui.closeInventory();
        else if (!this.ui.uiOpen()) this.ui.openInventory();
        return;
      }
      if (this.ui.uiOpen()) return;
      this.player.onKey(e.code, true, e.repeat);
    });
    document.addEventListener('keyup', (e) => {
      if (this.state !== 'playing') return;
      this.player.onKey(e.code, false, false);
    });
  }

  dropHeld() {
    const p = this.player;
    const s = p.heldItem();
    if (!s) return;
    const d = this.entities.spawnDrop(s.id, p.pos.x, p.pos.y + 1.3, p.pos.z);
    if (d) {
      const dir = p.lookDir();
      d.vel = { x: dir.x * 6, y: dir.y * 6 + 2, z: dir.z * 6 };
      d.pickupDelay = 1.6;
    }
    if (--s.count <= 0) p.hotbar[p.selected] = null;
    this.ui.refreshHotbar();
  }

  onPlayerDeath(cause) {
    this.ui.showDeath(cause);
    this.sound.play('hurt');
  }

  // ---------- 辅助 ----------
  makeBlockIcon(id) { return makeBlockIcon(this.atlas, id); }

  biomeName() {
    return BIOME_NAMES[this.world.biomeAt(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z))];
  }

  clockStr() {
    const h = (this.sky.timeOfDay * 24 + 6) % 24;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // ---------- 主循环 ----------
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    try {
      this.tick(t);
    } catch (e) {
      console.error(e);
      if (!this._errCount) this._errCount = 0;
      if (++this._errCount === 3) {
        const el = $('boot-error');
        if (el) {
          el.style.display = 'block';
          el.textContent = '游戏运行出错：' + (e.message || e) + '，请刷新重试。';
        }
      }
    }
  }

  tick(t) {
    let dt = Math.min((t - this.lastT) / 1000, 0.05);
    this.lastT = t;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }

    if (this.state === 'loading') {
      // 加紧生成出生点区块
      this.chunkTick(6, 6);
      const done = this.countReady();
      $('load-bar').style.width = Math.min(100, done / this.loadTotal * 100) + '%';
      if (done >= this.loadTotal) {
        this.state = 'playing';
        $('loading').style.display = 'none';
        $('boot-error').style.display = 'none';
        // 站稳：从天而降检测改为从高处向下找第一个实心方块
        const p = this.player;
        const bx = Math.floor(p.pos.x), bz = Math.floor(p.pos.z);
        let gy = WH - 2;
        while (gy > 1 && !blockInfo(this.world.getBlock(bx, gy, bz)).solid) gy--;
        p.pos.y = gy + 1.02;
        p.vel.y = 0;
        this.ui.toast(Touch.isTouch ? '左摇杆移动 · 点按放置 · 长按挖掘' : '欢迎来到方块世界！');
        this.lockPointer();
      }
    } else if (this.state === 'playing') {
      if (!this.paused && !this.ui.uiOpen()) {
        this.touch.applyMove();
        this.touch.overrideInput();
        this.player.update(dt, this.world);
        this.interact.update(dt);
        this.entities.updateSpawning(dt);
        this.entities.update(dt);
        this.sky.update(dt, this.camera.position);
        this.ui.tick(dt);
        // 水下视觉
        if (this.player.headInWater) {
          this.scene.fog.near = 1; this.scene.fog.far = 26;
          this.scene.fog.color.setRGB(0.12 * this.sky.dayLight + 0.02, 0.25 * this.sky.dayLight + 0.03, 0.5 * this.sky.dayLight + 0.06);
          $('water-overlay').style.opacity = 0.35;
        } else {
          this.sky.setViewDist(this.viewDist);
          $('water-overlay').style.opacity = 0;
        }
        // 材质昼夜
        const uDay = 0.14 + 0.86 * this.sky.dayLight;
        this.materials.dayUniform.value = uDay;
        this.interact.particles.setDay(uDay);
        // 保存
        this.saveT += dt;
        if (this.saveT > 12) { this.saveT = 0; Save.save(this); }
      }
      this.chunkTick(this.state === 'playing' ? 2 : 6, 2);
      this.ui.updateDebug(this.fps);
    }

    // 相机震动
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.5;
    }

    this.renderer.render(this.scene, this.camera);
  }

  countReady() {
    const w = this.world;
    const pcx = Math.floor(this.player.pos.x) >> 4;
    const pcz = Math.floor(this.player.pos.z) >> 4;
    let n = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (w.chunks.has(w.key(pcx + dx, pcz + dz))) n++;
    }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (this.meshCache.has(w.key(pcx + dx, pcz + dz))) n++;
    }
    return n;
  }

  solidBelow(p) {
    const id = this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.5), Math.floor(p.pos.z));
    return id !== B.AIR && id !== B.WATER && blockInfo(id).solid;
  }
}

// 启动
window.addEventListener('DOMContentLoaded', () => {
  try {
    window.game = new Game();
    window.__gameBooted = true;
    window.addEventListener('error', () => {
      const el = document.getElementById('boot-error');
      if (el && window.game.state === 'loading') {
        el.style.display = 'block';
        el.textContent = '世界生成遇到问题，请刷新重试。';
      }
    });
  } catch (e) {
    const el = document.getElementById('boot-error');
    if (el) {
      el.style.display = 'block';
      el.textContent = '初始化失败：' + e.message;
    }
    console.error(e);
  }
});
