// ===== 实体：掉落物 / 动物 / 僵尸 / TNT / 生成管理 =====
import * as THREE from 'three';
import { B, blockInfo } from './blocks.js';
import { stepEntity, onGroundCheck } from './physics.js';
import { mulberry32 } from './math.js';
import { tileUVh, tileUVv } from './textures.js';

const rnd = mulberry32(20260920);

// 每物种皮肤 {body, face}
let SKINS = null;
export function initSkins(skins) { SKINS = skins; }

function boxMesh(w, h, d, tex) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  return m;
}
function faceMesh(w, h, d, texBody, texFace) {
  const mats = [];
  for (let i = 0; i < 6; i++) mats.push(new THREE.MeshBasicMaterial({ map: i === 5 ? texFace : texBody }));
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
}

// 朝向约定：模型头在 -z，yaw=0 朝 -z（与相机一致）；前向 = (-sin yaw, 0, -cos yaw)

class Entity {
  constructor(x, y, z) {
    this.pos = { x, y, z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.w = 0.3; this.h = 0.9;
    this.yaw = rnd() * Math.PI * 2;
    this.hp = 10; this.dead = false;
    this.onGround = false; this.inWater = false; this.headInWater = false;
    this.group = new THREE.Group();
    this.hurtT = 0; this.age = 0;
    this.removeMe = false;
  }
  faceYawTo(tx, tz) {
    this.yaw = Math.atan2(-(tx - this.pos.x), -(tz - this.pos.z));
  }
  walkDir(speed, dt) {
    this.vel.x += (-Math.sin(this.yaw) * speed - this.vel.x) * Math.min(1, dt * 10);
    this.vel.z += (-Math.cos(this.yaw) * speed - this.vel.z) * Math.min(1, dt * 10);
  }
  applyWorld(dt, world) {
    const sub = Math.max(1, Math.ceil(dt / 0.02));
    const sdt = dt / sub;
    let bumped = false;
    for (let i = 0; i < sub; i++) {
      const vx = this.vel.x, vz = this.vel.z;
      stepEntity(world, this, 30, null, sdt);
      if (Math.abs(this.vel.x - vx) > 0.01 || Math.abs(this.vel.z - vz) > 0.01) bumped = true;
    }
    this.onGround = onGroundCheck(world, this);
    if (bumped && this.onGround) this.vel.y = 8.2; // 撞墙跳一格
    if (this.inWater) this.vel.y = Math.max(this.vel.y, this.vel.y + (2.2 - this.vel.y) * Math.min(1, dt * 6));
    if (this.pos.y < -20) this.removeMe = true;
    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.rotation.y = this.yaw;
    this.age += dt;
    if (this.hurtT > 0) {
      this.hurtT -= dt;
      this.setTint(this.hurtT > 0 ? 0xff6060 : 0xffffff);
    }
  }
  setTint(hex) {
    this.group.traverse(o => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.color.setHex(hex);
      }
    });
  }
  hurt(n, from) {
    if (this.dead) return;
    this.hp -= n;
    this.hurtT = 0.35;
    if (from) this.faceYawTo(from.x, from.z);
    this.onHurt && this.onHurt(from);
    if (this.hp <= 0) this.die();
  }
  die() {
    this.dead = true;
    this.deathT = 0.45;
  }
  deathUpdate(dt) {
    this.deathT -= dt;
    this.group.rotation.z = (1 - this.deathT / 0.45) * Math.PI / 2;
    this.group.scale.setScalar(Math.max(0.01, this.deathT / 0.45));
    if (this.deathT <= 0) this.removeMe = true;
  }
  updateShadow(dayLight) {
    // 按昼夜调整体色（共享材质不能单独调，实体材质独立所以可以）
    this.group.traverse(o => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (this.hurtT > 0) m.color.setHex(0xff6060);
          else m.color.setScalar(Math.min(1, dayLight + 0.18));
        }
      }
    });
  }
}

// ===== 掉落物 =====
class DropItem extends Entity {
  constructor(id, x, y, z, vel) {
    super(x, y, z);
    this.kind = 'drop';
    this.itemId = id;
    this.count = 1;
    this.w = 0.12; this.h = 0.24;
    this.age = 0; this.pickupDelay = 0.6;
    this.vel = vel || { x: (rnd() - 0.5) * 2, y: 3 + rnd() * 1.5, z: (rnd() - 0.5) * 2 };
    this.baseMat = new THREE.MeshBasicMaterial({ map: null, alphaTest: 0.4, side: THREE.DoubleSide });
    this.mesh = null;
  }
  build(atlas) {
    if (this.mesh) return;
    const info = blockInfo(this.itemId);
    if (info.cross || info.item) {
      const geo = new THREE.PlaneGeometry(0.36, 0.36);
      this.uvPlane(geo, atlas, info.tiles.all);
      this.mesh = new THREE.Mesh(geo, this.baseMat);
    } else {
      const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      this.uvBox(geo, atlas, info.tiles);
      this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: atlas.tex }));
    }
    this.mesh.position.y = this.h / 2;
    this.group.add(this.mesh);
  }
  uvBox(geo, atlas, tiles) {
    const uv = geo.attributes.uv;
    const faceTiles = [
      tiles.side || tiles.all, tiles.side || tiles.all,
      tiles.top || tiles.all, tiles.bottom || tiles.all,
      tiles.side || tiles.all, tiles.side || tiles.all,
    ];
    const { tileUVh, tileUVv } = DropItem._tu;
    for (let f = 0; f < 6; f++) {
      const [u0, u1] = tileUVh(atlas, atlas.tileIndex[faceTiles[f]]);
      const [v0, v1] = tileUVv(atlas, atlas.tileIndex[faceTiles[f]]);
      for (let vi = 0; vi < 4; vi++) {
        const i = f * 4 + vi;
        uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + (1 - uv.getY(i)) * (v1 - v0));
      }
    }
  }
  uvPlane(geo, atlas, name) {
    const { tileUVh, tileUVv } = DropItem._tu;
    const uv = geo.attributes.uv;
    const [u0, u1] = tileUVh(atlas, atlas.tileIndex[name]);
    const [v0, v1] = tileUVv(atlas, atlas.tileIndex[name]);
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + (1 - uv.getY(i)) * (v1 - v0));
  }
  update(dt, game) {
    if (!this.mesh) this.build(game.atlas);
    this.pickupDelay -= dt;
    this.age += dt;
    this.applyWorld(dt, game.world);
    if (this.dead) this.deathUpdate(dt);
    this.mesh.rotation.y = this.age * 1.6;
    if (this.age > 300) this.removeMe = true;
    const p = game.player;
    if (this.pickupDelay <= 0 && !p.dead) {
      const dx = p.pos.x - this.pos.x, dy = (p.pos.y + 0.8) - (this.pos.y + 0.2), dz = p.pos.z - this.pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 2.0) {
        this.vel.x += dx / d * 26 * dt;
        this.vel.y += dy / d * 26 * dt;
        this.vel.z += dz / d * 26 * dt;
      }
      if (d < 0.8) {
        if (p.addItem(this.itemId, this.count)) {
          game.sound.play('pop');
          this.removeMe = true;
        }
      }
    }
  }
}
DropItem._tu = null;

// ===== 动物 =====
class Animal extends Entity {
  constructor(type, x, y, z) {
    super(x, y, z);
    this.kind = 'animal';
    this.type = type; // pig | cow | sheep
    this.w = 0.42; this.h = 0.85;
    this.hp = 10;
    this.state = 'idle'; this.stateT = 1 + rnd() * 3;
    this.legPhase = 0;
    this.build();
  }
  build() {
    const s = SKINS[this.type];
    const body = boxMesh(0.62, 0.55, 1.05, s.body);
    body.position.set(0, 0.62, 0);
    const head = faceMesh(0.5, 0.5, 0.45, s.body, s.face);
    head.position.set(0, 0.78, -0.68);
    this.legs = [];
    const legGeo = [0.2, 0.36, 0.2];
    for (const [lx, lz] of [[-0.2, -0.35], [0.2, -0.35], [-0.2, 0.35], [0.2, 0.35]]) {
      const leg = boxMesh(...legGeo, s.body);
      leg.geometry.translate(0, -0.18, 0);
      leg.position.set(lx, 0.36, lz);
      this.legs.push(leg);
      this.group.add(leg);
    }
    this.group.add(body, head);
    if (this.type === 'sheep') {
      const wool = boxMesh(0.72, 0.62, 1.12, SKINS.wool);
      wool.position.set(0, 0.64, 0.03);
      this.group.add(wool);
    }
  }
  onHurt() {
    this.state = 'flee'; this.stateT = 2.5;
    this.yaw += Math.PI; // 背向攻击者逃跑
  }
  update(dt, game) {
    this.game = game;
    if (this.dead) { this.deathUpdate(dt); return; }
    this.stateT -= dt;
    if (this.stateT <= 0) {
      if (this.state === 'idle') { this.state = 'wander'; this.stateT = 1.5 + rnd() * 3; this.yaw = rnd() * Math.PI * 2; }
      else { this.state = 'idle'; this.stateT = 1 + rnd() * 4; }
    }
    let speed = 0;
    if (this.state === 'wander') speed = 1.1;
    else if (this.state === 'flee') speed = 3.2;
    if (speed > 0) this.walkDir(speed, dt);
    else { this.vel.x *= 0.8; this.vel.z *= 0.8; }
    if (speed > 0) this.legPhase += dt * speed * 3.4;
    let li = 0;
    for (const leg of this.legs) leg.rotation.x = Math.sin(this.legPhase + (li++ % 2 ? Math.PI : 0)) * 0.55 * (speed > 0 ? 1 : 0);
    this.applyWorld(dt, game.world);
  }
  drops() {
    if (this.type === 'pig') return [[B.PORK, 1 + ((rnd() * 2) | 0)]];
    if (this.type === 'cow') return [[B.STEAK, 1 + ((rnd() * 2) | 0)]];
    return [[B.WOOL, 1 + ((rnd() * 2) | 0)]];
  }
}

// ===== 僵尸 =====
class Zombie extends Entity {
  constructor(x, y, z) {
    super(x, y, z);
    this.kind = 'zombie';
    this.w = 0.3; this.h = 1.9;
    this.hp = 20;
    this.atkT = 0;
    this.legPhase = 0;
    this.build();
  }
  build() {
    const s = SKINS.zombie;
    const bodyM = new THREE.MeshBasicMaterial({ map: s.body });
    const legM = new THREE.MeshBasicMaterial({ map: s.pants });
    const head = faceMesh(0.5, 0.5, 0.5, s.body, s.face);
    head.position.set(0, 1.65, 0);
    const body = boxMesh(0.5, 0.72, 0.26, s.zshirt || s.body);
    body.position.set(0, 1.04, 0);
    this.arms = [];
    for (const sx of [-0.34, 0.34]) {
      const arm = boxMesh(0.2, 0.72, 0.2, s.body);
      arm.geometry.translate(0, -0.3, 0);
      arm.position.set(sx, 1.38, 0);
      arm.rotation.x = -Math.PI / 2;
      this.arms.push(arm);
      this.group.add(arm);
    }
    this.legs = [];
    for (const sx of [-0.13, 0.13]) {
      const leg = boxMesh(0.22, 0.68, 0.22, s.zpants || s.pants || s.body);
      leg.geometry.translate(0, -0.34, 0);
      leg.position.set(sx, 0.68, 0);
      this.legs.push(leg);
      this.group.add(leg);
    }
    this.group.add(body, head);
  }
  update(dt, game) {
    if (this.dead) { this.deathUpdate(dt); return; }
    const p = game.player;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    // 白天燃烧
    if (game.sky.dayLight > 0.75 && game.sky.sunUp()) {
      this.burnT = (this.burnT || 0) + dt;
      if (this.burnT > 0.8) {
        this.burnT = 0;
        this.hurt(2, null);
        game.interact.particles.burst(this.pos.x, this.pos.y + 1.4, this.pos.z, [1, 0.55, 0.15], 5, 1.6);
      }
    }
    // 追击
    if (d < 26 && !p.dead) {
      this.faceYawTo(p.pos.x, p.pos.z);
      const speed = 2.35;
      this.walkDir(speed, dt);
      this.legPhase += dt * speed * 3;
      this.atkT -= dt;
      const dy = Math.abs(p.pos.y - this.pos.y);
      if (d < 1.5 && dy < 2 && this.atkT <= 0) {
        this.atkT = 1.1;
        p.damage(3, '僵尸');
      }
    } else {
      this.vel.x *= 0.85; this.vel.z *= 0.85;
    }
    let li = 0;
    for (const leg of this.legs) leg.rotation.x = Math.sin(this.legPhase + (li++ % 2 ? Math.PI : 0)) * 0.6;
    this.applyWorld(dt, game.world);
  }
}

// ===== 点燃的 TNT =====
class PrimedTNT extends Entity {
  constructor(x, y, z, fuse, atlas) {
    super(x + 0.5, y, z + 0.5);
    this.kind = 'tnt';
    this.w = 0.49; this.h = 0.98;
    this.fuse = fuse;
    const geo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    const uv = geo.attributes.uv;
    const tiles = { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' };
    const faceTiles = [tiles.side, tiles.side, tiles.top, tiles.bottom, tiles.side, tiles.side];
    const { tileUVh, tileUVv } = PrimedTNT._tu;
    for (let f = 0; f < 6; f++) {
      const [u0, u1] = tileUVh(atlas, atlas.tileIndex[faceTiles[f]]);
      const [v0, v1] = tileUVv(atlas, atlas.tileIndex[faceTiles[f]]);
      for (let vi = 0; vi < 4; vi++) {
        const i = f * 4 + vi;
        uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + (1 - uv.getY(i)) * (v1 - v0));
      }
    }
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: atlas.tex }));
    this.mesh.position.y = 0.49;
    this.group.add(this.mesh);
    this.vel.y = 2.4;
  }
  update(dt, game) {
    this.applyWorld(dt, game.world);
    this.fuse -= dt;
    const blink = Math.sin(this.fuse * (this.fuse < 0.7 ? 30 : 12)) > 0;
    this.mesh.material.color.setHex(blink ? 0xffffff : 0x888888);
    if (this.fuse <= 0) {
      this.removeMe = true;
      game.interact.explode(Math.round(this.pos.x - 0.5) + 0.5, this.pos.y + 0.5, Math.round(this.pos.z - 0.5) + 0.5, 4);
    }
  }
}
PrimedTNT._tu = null;

// ===== 实体管理器 =====
export class Entities {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.spawnT = 0;
    DropItem._tu = { tileUVh, tileUVv };
    PrimedTNT._tu = DropItem._tu;
  }

  spawnDrop(id, x, y, z, vel) {
    if (this.list.filter(e => e.kind === 'drop').length > 90) return;
    const d = new DropItem(id, x, y, z, vel);
    d.build(this.game.atlas);
    this.list.push(d);
    this.game.scene.add(d.group);
    return d;
  }

  spawnAnimal(type, x, y, z) {
    const a = new Animal(type, x, y, z);
    this.list.push(a);
    this.game.scene.add(a.group);
    return a;
  }

  spawnZombie(x, y, z) {
    const zz = new Zombie(x, y, z);
    this.list.push(zz);
    this.game.scene.add(zz.group);
    return zz;
  }

  primeTNT(x, y, z, fuse) {
    const t = new PrimedTNT(x, y, z, fuse, this.game.atlas);
    this.list.push(t);
    this.game.scene.add(t.group);
  }

  // 定期自然生成
  updateSpawning(dt) {
    const g = this.game;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 3;
    const p = g.player;
    const animals = this.list.filter(e => e.kind === 'animal' && !e.dead).length;
    const zombies = this.list.filter(e => e.kind === 'zombie' && !e.dead).length;
    // 动物
    if (animals < 12) {
      const a = rnd() * Math.PI * 2, r = 22 + rnd() * 22;
      const x = Math.floor(p.pos.x + Math.cos(a) * r), z = Math.floor(p.pos.z + Math.sin(a) * r);
      const y = g.world.heightAt(x, z);
      const surf = g.world.getBlock(x, y, z);
      if (y > 33 && (surf === B.GRASS || surf === B.SNOW_GRASS) && !g.world.getBlock(x, y + 1, z)) {
        const type = ['pig', 'cow', 'sheep'][(rnd() * 3) | 0];
        const n = 2 + ((rnd() * 2) | 0);
        for (let i = 0; i < n; i++)
          this.spawnAnimal(type, x + 0.5 + rnd() * 2 - 1, y + 1.2, z + 0.5 + rnd() * 2 - 1);
      }
    }
    // 夜晚僵尸
    if (g.sky.isNight() && zombies < 6 && p.mode === 'survival') {
      const a = rnd() * Math.PI * 2, r = 22 + rnd() * 18;
      const x = Math.floor(p.pos.x + Math.cos(a) * r), z = Math.floor(p.pos.z + Math.sin(a) * r);
      const y = g.world.heightAt(x, z);
      if (y > 32 && !g.world.getBlock(x, y + 1, z)) this.spawnZombie(x + 0.5, y + 1.1, z + 0.5);
    }
    // 清理远处的动物
    for (const e of this.list) {
      if (e.kind === 'animal' && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) > 90) e.removeMe = true;
    }
  }

  update(dt) {
    const g = this.game;
    for (const e of this.list) {
      if (e.kind === 'drop') e.update(dt, g);
      else {
        e.update(dt, g);
        e.updateShadow(g.sky.dayLight);
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].removeMe) {
        this.game.scene.remove(this.list[i].group);
        this.list[i].group.traverse(o => {
          if (o.isMesh) {
            o.geometry.dispose();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) m.dispose();
          }
        });
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const e of this.list) this.game.scene.remove(e.group);
    this.list.length = 0;
  }
}

export function makeWoolSkin() {
  return SKINS.wool;
}
export { SKINS };
