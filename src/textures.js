// ===== 程序化像素纹理：图集 / 裂缝 / 图标 / 皮肤 / 日月云 =====
// 全部 16x16 逐像素绘制，确定性随机保证每次生成一致
import * as THREE from '../vendor/three.module.js';
import { mulberry32 } from './math.js';
import { BLOCKS, B } from './blocks.js';

const T = 16; // tile 尺寸
const ATLAS_COLS = 16;

function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// 在 ImageData 上画点的助手
function painter(img) {
  return (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= T || y >= T) return;
    const i = (y * T + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
  };
}

// 基础噪点填充
function noiseFill(set, rnd, r, g, b, vary) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const n = (rnd() * 2 - 1) * vary;
    set(x, y, r + n, g + n, b + n);
  }
}
function speckle(set, rnd, count, r, g, b, vary = 8) {
  for (let i = 0; i < count; i++) {
    const n = (rnd() * 2 - 1) * vary;
    set((rnd() * T) | 0, (rnd() * T) | 0, r + n, g + n, b + n);
  }
}

// ===== 各 tile 绘制函数 =====
const DRAW = {
  grass_top(set, rnd) {
    noiseFill(set, rnd, 116, 178, 76, 13);
    speckle(set, rnd, 26, 94, 152, 58);
    speckle(set, rnd, 14, 137, 197, 96);
  },
  dirt(set, rnd) {
    noiseFill(set, rnd, 134, 96, 67, 15);
    speckle(set, rnd, 22, 104, 72, 48);
    speckle(set, rnd, 10, 158, 120, 88);
  },
  grass_side(set, rnd) {
    noiseFill(set, rnd, 134, 96, 67, 15);
    speckle(set, rnd, 18, 104, 72, 48);
    for (let x = 0; x < T; x++) {
      const depth = 2 + ((rnd() * 2.4) | 0);
      for (let y = 0; y < depth; y++) {
        const n = (rnd() * 2 - 1) * 13;
        set(x, y, 116 + n, 178 + n, 76 + n);
      }
    }
  },
  stone(set, rnd) {
    noiseFill(set, rnd, 127, 127, 127, 11);
    for (let i = 0; i < 5; i++) {
      const x0 = (rnd() * 13) | 0, y0 = (rnd() * 15) | 0, len = 2 + ((rnd() * 3) | 0);
      for (let d = 0; d < len; d++) set(x0 + d, y0 + ((rnd() * 2) | 0), 108, 108, 108);
    }
    speckle(set, rnd, 10, 143, 143, 143);
  },
  cobble(set, rnd) {
    noiseFill(set, rnd, 90, 90, 90, 6);
    const stones = [[0, 0, 7, 5], [8, 0, 7, 7], [0, 6, 5, 6], [6, 8, 5, 4], [6, 13, 9, 3], [12, 8, 3, 4], [0, 13, 5, 3]];
    for (const [sx, sy, sw, sh] of stones) {
      for (let y = 0; y < sh - 1; y++) for (let x = 0; x < sw - 1; x++) {
        const n = (rnd() * 2 - 1) * 12;
        set(sx + x, sy + y, 128 + n, 128 + n, 128 + n);
      }
      for (let x = 0; x < sw - 1; x++) set(sx + x, sy, 100 + rnd() * 14, 100, 100);
    }
  },
  log_side(set, rnd) {
    for (let x = 0; x < T; x++) {
      const stripe = Math.sin(x * 2.1) * 10 + (rnd() * 2 - 1) * 6;
      for (let y = 0; y < T; y++) {
        const n = (rnd() * 2 - 1) * 5 + stripe;
        set(x, y, 107 + n, 84 + n, 55 + n * 0.7);
      }
    }
    const kx = 3 + ((rnd() * 9) | 0), ky = 4 + ((rnd() * 7) | 0);
    set(kx, ky, 60, 44, 26); set(kx, ky + 1, 60, 44, 26);
  },
  log_top(set, rnd) {
    noiseFill(set, rnd, 107, 84, 55, 8);
    const rings = [7, 5, 3];
    const cols = [[168, 134, 84], [139, 108, 65], [168, 134, 84]];
    for (let ri = 0; ri < 3; ri++) {
      const r = rings[ri], c = cols[ri];
      for (let y = 8 - r; y <= 8 + r - 1; y++) for (let x = 8 - r; x <= 8 + r - 1; x++) {
        const edge = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (edge > r - 1 && edge <= r) {
          const n = (rnd() * 2 - 1) * 8;
          set(x, y, c[0] + n, c[1] + n, c[2] + n);
        }
      }
    }
  },
  leaves(set, rnd) {
    noiseFill(set, rnd, 58, 106, 32, 16);
    speckle(set, rnd, 30, 44, 84, 24);
    speckle(set, rnd, 22, 78, 132, 46);
  },
  planks(set, rnd) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const n = (rnd() * 2 - 1) * 7 + Math.sin(y * 1.7) * 4;
      set(x, y, 162 + n, 130 + n, 78 + n * 0.8);
    }
    for (const ry of [3, 7, 11, 15]) for (let x = 0; x < T; x++) set(x, ry, 110, 85, 48);
    set(4, 1, 110, 85, 48); set(4, 2, 110, 85, 48);
    set(11, 5, 110, 85, 48); set(11, 6, 110, 85, 48);
    set(6, 9, 110, 85, 48); set(6, 10, 110, 85, 48);
  },
  sand(set, rnd) {
    noiseFill(set, rnd, 219, 211, 160, 9);
    speckle(set, rnd, 12, 196, 186, 132);
    speckle(set, rnd, 8, 234, 228, 184);
  },
  water(set, rnd) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const n = (rnd() * 2 - 1) * 10 + Math.sin((x + y * 2) * 0.9) * 7;
      set(x, y, 52 + n * 0.4, 110 + n * 0.7, 213 + n);
    }
  },
  glass(set, rnd) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, 255, 255, 255, 0);
    for (let i = 0; i < T; i++) {
      set(i, 0, 224, 245, 245); set(i, 15, 224, 245, 245);
      set(0, i, 224, 245, 245); set(15, i, 224, 245, 245);
    }
    for (let d = 0; d < 6; d++) set(3 + d, 2 + d, 236, 250, 250, 190);
    for (let d = 0; d < 4; d++) set(9 + d, 2 + d, 236, 250, 250, 150);
  },
  bedrock(set, rnd) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const v = rnd() < 0.42 ? 30 + rnd() * 22 : 84 + rnd() * 40;
      set(x, y, v, v, v);
    }
  },
  snow(set, rnd) { noiseFill(set, rnd, 240, 250, 250, 5); speckle(set, rnd, 6, 222, 236, 238); },
  snow_side(set, rnd) {
    noiseFill(set, rnd, 134, 96, 67, 15);
    speckle(set, rnd, 16, 104, 72, 48);
    for (let x = 0; x < T; x++) {
      const depth = 3 + ((rnd() * 2) | 0);
      for (let y = 0; y < depth; y++) { const n = (rnd() * 2 - 1) * 5; set(x, y, 240 + n, 250 + n, 250 + n); }
    }
  },
  gravel(set, rnd) {
    noiseFill(set, rnd, 131, 126, 122, 15);
    speckle(set, rnd, 16, 106, 94, 84, 10);
    speckle(set, rnd, 10, 158, 152, 146, 10);
  },
  glowstone(set, rnd) {
    noiseFill(set, rnd, 172, 132, 72, 12);
    for (let i = 0; i < 9; i++) {
      const x = (rnd() * 14) | 0, y = (rnd() * 14) | 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
        set(x + dx, y + dy, 255 - rnd() * 20, 226 - rnd() * 24, 140 + rnd() * 30);
    }
  },
  bricks(set, rnd) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const row = (y / 4) | 0;
      const off = row % 2 === 0 ? 0 : 4;
      const mortar = (y % 4 === 3) || ((x + off) % 8 === 7);
      if (mortar) set(x, y, 152, 152, 152);
      else { const n = (rnd() * 2 - 1) * 9; set(x, y, 150 + n, 88 + n, 66 + n); }
    }
  },
  tnt_side(set, rnd) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const n = (rnd() * 2 - 1) * 10;
      set(x, y, 202 + n, 62 + n, 30 + n);
    }
    for (let x = 0; x < T; x++) for (let y = 5; y < 10; y++) set(x, y, 232, 218, 193);
    const fontT = [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2], [1, 3]];
    const fontN = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [2, 0], [2, 1], [2, 2], [2, 3]];
    const drawGlyph = (g, ox) => { for (const [gx, gy] of g) set(ox + gx, 6 + gy, 30, 26, 26); };
    drawGlyph(fontT, 2); drawGlyph(fontN, 6); drawGlyph(fontT, 10);
  },
  tnt_top(set, rnd) {
    noiseFill(set, rnd, 202, 62, 30, 10);
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) { const n = (rnd() * 2 - 1) * 6; set(x, y, 210 + n, 180 + n, 130 + n); }
    for (let y = 7; y < 9; y++) for (let x = 7; x < 9; x++) set(x, y, 60, 50, 40);
  },
  tnt_bottom(set, rnd) { noiseFill(set, rnd, 202, 62, 30, 10); },
  wool(set, rnd) {
    noiseFill(set, rnd, 232, 232, 232, 7);
    for (let i = 0; i < 7; i++) {
      const y = (rnd() * 16) | 0; let x = (rnd() * 8) | 0;
      for (let d = 0; d < 6; d++) { set((x + d) % 16, y, 208, 208, 210); x += rnd() < 0.4 ? 1 : 0; }
    }
  },
  cactus_side(set, rnd) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const edge = x === 0 || x === 15;
      const n = (rnd() * 2 - 1) * 8 + (x % 5 === 2 ? 8 : 0);
      const v = edge ? 0.75 : 1;
      set(x, y, (88 + n) * v, (138 + n) * v, (48 + n) * v);
    }
    speckle(set, rnd, 7, 208, 224, 190);
  },
  cactus_top(set, rnd) {
    noiseFill(set, rnd, 96, 148, 54, 9);
    for (let i = 2; i < 14; i++) { set(i, 2, 70, 110, 38); set(i, 13, 70, 110, 38); set(2, i, 70, 110, 38); set(13, i, 70, 110, 38); }
  },
  birch_side(set, rnd) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const n = (rnd() * 2 - 1) * 7 + Math.sin(x * 1.9) * 5;
      set(x, y, 216 + n, 208 + n, 198 + n);
    }
    for (let i = 0; i < 4; i++) {
      const x = (rnd() * 13) | 0, y = (rnd() * 15) | 0, w = 1 + ((rnd() * 2) | 0);
      for (let d = 0; d < w; d++) set(x + d, y, 48, 44, 40);
    }
  },
  birch_top(set, rnd) {
    noiseFill(set, rnd, 196, 186, 150, 8);
    for (let r = 6; r > 1; r -= 2) for (let y = 8 - r; y < 8 + r; y++) for (let x = 8 - r; x < 8 + r; x++) {
      const edge = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (edge > r - 1.2) set(x, y, 160, 148, 116);
    }
  },
  birch_leaves(set, rnd) {
    noiseFill(set, rnd, 106, 160, 62, 16);
    speckle(set, rnd, 24, 84, 132, 48);
    speckle(set, rnd, 16, 134, 186, 84);
  },
  spruce_side(set, rnd) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const n = (rnd() * 2 - 1) * 6 + Math.sin(x * 2.3) * 8;
      set(x, y, 74 + n, 54 + n, 34 + n * 0.7);
    }
  },
  spruce_top(set, rnd) {
    noiseFill(set, rnd, 74, 54, 34, 7);
    for (let r = 6; r > 1; r -= 2) for (let y = 8 - r; y < 8 + r; y++) for (let x = 8 - r; x < 8 + r; x++) {
      const edge = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (edge > r - 1.2) set(x, y, 96, 72, 46);
    }
  },
  spruce_leaves(set, rnd) {
    noiseFill(set, rnd, 46, 82, 52, 13);
    speckle(set, rnd, 26, 32, 62, 40);
    speckle(set, rnd, 12, 66, 106, 70);
  },
  craft_top(set, rnd) {
    DRAW.planks(set, rnd);
    for (let i = 3; i < 13; i++) { set(i, 3, 96, 72, 42); set(i, 12, 96, 72, 42); set(3, i, 96, 72, 42); set(12, i, 96, 72, 42); }
    set(7, 7, 130, 100, 60); set(8, 8, 130, 100, 60);
  },
  craft_side(set, rnd) {
    DRAW.planks(set, rnd);
    for (let y = 3; y < 7; y++) { set(4, y, 120, 88, 52); set(5, y, 120, 88, 52); }
    for (let y = 4; y < 8; y++) { set(10, y, 110, 82, 48); set(11, y, 110, 82, 48); }
  },
  bookshelf(set, rnd) {
    DRAW.planks(set, rnd);
    const cols = [[158, 44, 40], [190, 130, 40], [60, 110, 60], [50, 80, 150], [130, 60, 140], [200, 170, 60], [90, 60, 40]];
    for (const ry of [2, 9]) {
      for (let x = 1; x < 15;) {
        const w = 1 + ((rnd() * 2) | 0);
        const c = cols[(rnd() * cols.length) | 0];
        for (let dx = 0; dx < w && x + dx < 15; dx++)
          for (let y = ry; y < ry + 5; y++) set(x + dx, y, c[0] + (rnd() * 2 - 1) * 12, c[1], c[2]);
        x += w;
      }
    }
  },
  sandstone(set, rnd) {
    noiseFill(set, rnd, 216, 208, 158, 7);
    for (const ry of [0, 15]) for (let x = 0; x < T; x++) set(x, ry, 196, 188, 138);
    for (let i = 0; i < 5; i++) {
      const y = 2 + ((rnd() * 12) | 0), x0 = (rnd() * 10) | 0, len = 3 + ((rnd() * 4) | 0);
      for (let d = 0; d < len; d++) set(x0 + d, y, 200, 192, 142);
    }
  },
  sandstone_top(set, rnd) {
    noiseFill(set, rnd, 222, 214, 164, 6);
    for (let i = 4; i < 12; i++) { set(i, 4, 204, 196, 146); set(i, 11, 204, 196, 146); set(4, i, 204, 196, 146); set(11, i, 204, 196, 146); }
  },
  pumpkin_side(set, rnd) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const rib = x % 5 === 0 ? -26 : 0;
      const n = (rnd() * 2 - 1) * 8;
      set(x, y, 198 + n + rib, 122 + n * 0.8 + rib * 0.6, 26 + n * 0.5);
    }
  },
  pumpkin_top(set, rnd) {
    noiseFill(set, rnd, 190, 118, 28, 9);
    for (let i = 6; i < 10; i++) for (let j = 6; j < 10; j++) set(i, j, 106, 82, 38);
  },
  pork(set, rnd) {
    noiseFill(set, rnd, 238, 150, 150, 9);
    speckle(set, rnd, 20, 214, 118, 126);
    for (let i = 0; i < 4; i++) { const x = 2 + ((rnd() * 11) | 0), y = 2 + ((rnd() * 11) | 0); set(x, y, 250, 196, 190); set(x + 1, y, 250, 196, 190); }
  },
  steak(set, rnd) {
    noiseFill(set, rnd, 122, 74, 42, 10);
    speckle(set, rnd, 18, 94, 54, 28);
    speckle(set, rnd, 10, 156, 104, 62);
  },
};

function drawPlant(kind) {
  return (set, rnd) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, 0, 0, 0, 0);
    if (kind === 'tallgrass') {
      for (let b = 0; b < 7; b++) {
        let x = 2 + ((rnd() * 12) | 0);
        const h = 6 + ((rnd() * 8) | 0);
        for (let d = 0; d < h; d++) {
          const y = 15 - d;
          if (d > h * 0.5 && rnd() < 0.35) x += rnd() < 0.5 ? 1 : -1;
          const g = 120 + d * 4 + rnd() * 20;
          set(x, y, 60 + rnd() * 20, 150 + d * 3, 52);
        }
      }
      return;
    }
    // 花：茎 + 花头
    const stemX = 7;
    for (let y = 8; y < 16; y++) set(stemX, y, 58, 122, 40);
    set(stemX - 1, 11, 58, 122, 40); set(stemX + 1, 12, 58, 122, 40);
    if (kind === 'dandelion') {
      const c = [250, 218, 56];
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) set(stemX + dx, 5 + dy, c[0], c[1], c[2]);
      set(stemX, 5, 255, 240, 140);
    } else {
      for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0], [0, 0], [1, -1], [-1, 1], [1, 1], [-1, -1]]) set(stemX + dx, 5 + dy, 208, 48, 40);
      for (const [dx, dy] of [[1, -1], [-1, 1], [2, 0], [-2, 0]]) set(stemX + dx, 5 + dy, 168, 34, 30);
      set(stemX, 5, 40, 20, 16);
    }
  };
}
DRAW.dandelion = drawPlant('dandelion');
DRAW.poppy = drawPlant('poppy');
DRAW.tallgrass = drawPlant('tallgrass');

// 矿石 = 石头底 + 矿斑
function oreTile(oreR, oreG, oreB) {
  return (set, rnd) => {
    DRAW.stone(set, rnd);
    const spots = [[3, 3], [9, 5], [5, 10], [11, 11]];
    const n = 2 + ((rnd() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const [sx, sy] = spots[(rnd() * spots.length) | 0];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        if (rnd() < 0.85) set(sx + dx, sy + dy, oreR + (rnd() * 2 - 1) * 16, oreG + (rnd() * 2 - 1) * 16, oreB + (rnd() * 2 - 1) * 16);
      }
      if (rnd() < 0.7) set(sx - 1, sy + ((rnd() * 2) | 0), oreR * 0.8, oreG * 0.8, oreB * 0.8);
    }
  };
}
DRAW.coal_ore = oreTile(38, 38, 38);
DRAW.iron_ore = oreTile(216, 176, 140);
DRAW.gold_ore = oreTile(250, 238, 76);
DRAW.diamond_ore = oreTile(98, 232, 216);

// ===== 构建图集 =====
export function createAtlas() {
  const names = Object.keys(DRAW);
  const tileIndex = {};
  const rows = Math.ceil(names.length / ATLAS_COLS);
  const atlas = cnv(ATLAS_COLS * T, Math.max(1, rows) * T);
  const ctx = atlas.getContext('2d');
  names.forEach((name, i) => {
    const c = cnv(T, T);
    const cctx = c.getContext('2d');
    const img = cctx.createImageData(T, T);
    DRAW[name](painter(img), mulberry32(0x9E3779B9 ^ (i * 7919 + 13)));
    cctx.putImageData(img, 0, 0);
    ctx.drawImage(c, (i % ATLAS_COLS) * T, ((i / ATLAS_COLS) | 0) * T);
    tileIndex[name] = i;
  });
  const tex = new THREE.CanvasTexture(atlas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, tileIndex, canvas: atlas, cols: ATLAS_COLS, rows: Math.max(1, rows) };
}

// tile index → [u0,v0,u1,v1]（半像素内缩防渗色）
export function tileUV(atlas, idx) {
  const pad = 0.5;
  const cx = (idx % atlas.cols) * T, cy = ((idx / atlas.cols) | 0) * T;
  const W = atlas.cols * T, H = atlas.rows * T;
  return [
    (cx + pad) / W, (cy + pad) / W, (cx + T - pad) / W, (cy + T - pad) / H,
    cy / H, (cy + T) / H,
  ];
}
// u0,u1 供水平插值；v 单独算
export function tileUVh(atlas, idx) {
  const pad = 0.5;
  const cx = (idx % atlas.cols) * T;
  const W = atlas.cols * T;
  return [(cx + pad) / W, (cx + T - pad) / W];
}
export function tileUVv(atlas, idx) {
  const pad = 0.5;
  const cy = ((idx / atlas.cols) | 0) * T;
  const H = atlas.rows * T;
  return [(cy + pad) / H, (cy + T - pad) / H];
}

// ===== 裂缝纹理（10 阶段）=====
export function createCrackTextures() {
  const texs = [];
  for (let stage = 0; stage < 10; stage++) {
    const c = cnv(T, T);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(T, T);
    const set = painter(img);
    const rnd = mulberry32(777);
    const branches = 3 + stage;
    for (let b = 0; b < branches; b++) {
      let x = 8, y = 8;
      let dx = rnd() < 0.5 ? 1 : -1, dy = rnd() < 0.5 ? 1 : -1;
      const len = 2 + ((stage / 10) * 9) * (0.6 + rnd() * 0.8);
      for (let d = 0; d < len; d++) {
        set(x & 15, y & 15, 20, 16, 12, 200);
        if (stage > 4 && rnd() < 0.4) set((x + 1) & 15, y & 15, 20, 16, 12, 140);
        x += rnd() < 0.7 ? dx : 0; y += rnd() < 0.7 ? dy : 0;
        if (rnd() < 0.25) dx = -dx; if (rnd() < 0.25) dy = -dy;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    texs.push(tex);
  }
  return texs;
}

// ===== 等距方块图标（给 UI）=====
function drawFace(ctx, tileCanvas, m, darken) {
  ctx.save();
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(tileCanvas, 0, 0);
  if (darken > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(0,0,0,' + darken + ')';
    ctx.fillRect(0, 0, T, T);
  }
  ctx.restore();
}

export function makeBlockIcon(atlas, id, size = 56) {
  const info = BLOCKS[id];
  const c = cnv(size, size);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const tileCv = (name) => {
    const idx = atlas.tileIndex[name];
    const t = cnv(T, T);
    t.getContext('2d').drawImage(atlas.canvas, (idx % atlas.cols) * T, ((idx / atlas.cols) | 0) * T, T, T, 0, 0, T, T);
    return t;
  };
  const topName = info.tiles.top || info.tiles.all;
  const sideName = info.tiles.side || info.tiles.all;
  const s = size / 35; // 缩放
  const e = size / 2, f = size * 0.07;
  if (info.cross || info.item) {
    const t = tileCv(sideName);
    ctx.drawImage(t, 0, 0, T, T, size * 0.08, size * 0.08, size * 0.84, size * 0.84);
    return c.toDataURL();
  }
  drawFace(ctx, tileCv(topName), [s, s / 2, -s, s / 2, e, f], 0);
  drawFace(ctx, tileCv(sideName), [s, s / 2, 0, s, e - 16 * s, f + 8 * s], 0.22);
  drawFace(ctx, tileCv(sideName), [s, -s / 2, 0, s, e, f + 16 * s], 0.42);
  return c.toDataURL();
}

// ===== 生物皮肤 =====
function skinCanvas(draw) {
  const c = cnv(16, 16);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(16, 16);
  draw(painter(img), mulberry32(4242));
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function flatFill(set, r, g, b, vary, seed = 1) {
  const rnd = mulberry32(seed);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = (rnd() * 2 - 1) * vary;
    set(x, y, r + n, g + n, b + n);
  }
}

export function createSkins() {
  const pig = skinCanvas((set, rnd) => {
    flatFill(set, 238, 160, 150, 9);
    // 脸部区域画在上方 8x8：眼 + 鼻
    set(3, 3, 30, 30, 30); set(4, 3, 30, 30, 30);
    set(11, 3, 30, 30, 30); set(12, 3, 30, 30, 30);
    for (let y = 6; y < 10; y++) for (let x = 5; x < 11; x++) set(x, y, 226, 128, 122);
    set(6, 7, 150, 60, 60); set(9, 7, 150, 60, 60);
  });
  const sheep = skinCanvas((set, rnd) => {
    flatFill(set, 232, 232, 230, 7);
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) { const n = (rnd() * 2 - 1) * 6; set(x, y, 200 + n, 176 + n, 148 + n); }
    set(5, 6, 30, 30, 30); set(6, 6, 30, 30, 30);
    set(9, 6, 30, 30, 30); set(10, 6, 30, 30, 30);
  });
  const cow = skinCanvas((set, rnd) => {
    flatFill(set, 110, 76, 52, 10);
    for (let i = 0; i < 5; i++) {
      const x = (rnd() * 12) | 0, y = (rnd() * 12) | 0, w = 2 + ((rnd() * 3) | 0);
      for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) set(x + dx, y + dy, 226, 222, 216);
    }
    set(4, 5, 28, 28, 28); set(5, 5, 28, 28, 28);
    set(10, 5, 28, 28, 28); set(11, 5, 28, 28, 28);
    for (let y = 9; y < 13; y++) for (let x = 5; x < 11; x++) set(x, y, 208, 190, 180);
  });
  const zombie = skinCanvas((set, rnd) => {
    flatFill(set, 96, 160, 96, 10);
    set(4, 6, 20, 20, 20); set(5, 6, 20, 20, 20);
    set(10, 6, 20, 20, 20); set(11, 6, 20, 20, 20);
    for (let x = 6; x < 10; x++) set(x, 11, 40, 70, 40);
  });
  const zombieShirt = skinCanvas((set, rnd) => { flatFill(set, 0, 150, 150, 9); });
  const zombiePants = skinCanvas((set, rnd) => { flatFill(set, 60, 60, 150, 9); });
  const woolSkin = skinCanvas((set, rnd) => { flatFill(set, 238, 238, 236, 7); });
  return { pig, sheep, cow, zombie, wool: woolSkin, zshirt: zombieShirt, zpants: zombiePants };
}

// ===== 日 / 月 / 云 =====
export function createSkyTextures() {
  const sun = cnv(32, 32);
  {
    const ctx = sun.getContext('2d');
    ctx.fillStyle = '#FDF4C8'; ctx.fillRect(4, 4, 24, 24);
    ctx.fillStyle = '#FFFDE8'; ctx.fillRect(8, 8, 16, 16);
  }
  const moon = cnv(32, 32);
  {
    const ctx = moon.getContext('2d');
    ctx.fillStyle = '#D8DDE4'; ctx.fillRect(6, 6, 20, 20);
    ctx.fillStyle = '#B8BEC8';
    ctx.fillRect(10, 10, 5, 5); ctx.fillRect(18, 16, 4, 4); ctx.fillRect(12, 19, 3, 3);
  }
  const cloud = cnv(128, 128);
  {
    const ctx = cloud.getContext('2d');
    const img = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = 0;
    }
    // 简单 value-noise 阈值云团
    const rnd = mulberry32(20260920);
    const grid = new Float32Array(32 * 32);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const val = (x, y) => {
      const gx = (x / 4) | 0, gy = (y / 4) | 0;
      const fx = (x % 4) / 4, fy = (y % 4) / 4;
      const g = (a, b) => grid[((b & 31) * 32) + (a & 31)];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return g(gx, gy) * (1 - sx) * (1 - sy) + g(gx + 1, gy) * sx * (1 - sy)
        + g(gx, gy + 1) * (1 - sx) * sy + g(gx + 1, gy + 1) * sx * sy;
    };
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const v = val(x, y) * 0.7 + val((x * 2) % 128, (y * 2) % 128) * 0.3;
      if (v > 0.58) {
        const i = (y * 128 + x) * 4;
        img.data[i + 3] = 235;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const mk = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    return t;
  };
  return { sun: mk(sun), moon: mk(moon), cloud: mk(cloud) };
}

// 把 atlas 的 canvas 保留下来给图标绘制用
export function attachAtlasCanvas(atlas) { atlas.canvas = atlas.tex.image; return atlas; }
