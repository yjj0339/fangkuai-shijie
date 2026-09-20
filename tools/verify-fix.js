/**
 * 方向与启动修复验证：
 * 1. 真实键盘事件按下 W/A/S/D，在 4 个朝向下检查位移方向是否符合 MC 直觉
 * 2. 手机模拟（触屏）点击标题按钮能否进入游戏
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

function findEdge() {
  const candidates = [
    ['C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
    ['C:', 'Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
  ];
  for (const parts of candidates) {
    const p = parts.join(path.sep);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const PAGE_URL = 'http://localhost:5188/';
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

async function startGame(page) {
  await page.evaluate(() => document.getElementById('btn-survival').click());
  await page.waitForFunction(() => {
    const l = document.getElementById('loading');
    return l && l.style.display === 'none';
  }, { timeout: 60000 });
  await new Promise(r => setTimeout(r, 800));
}

async function moveProbe(page, yaw, key, holdMs = 900) {
  return page.evaluate(async (yaw, key, holdMs) => {
    const g = window.game;
    const p = g.player;
    p.yaw = yaw; p.pitch = 0;
    const x0 = p.pos.x, z0 = p.pos.z;
    p.keys.add(key);
    await new Promise(r => setTimeout(r, holdMs));
    p.keys.delete(key);
    const dx = p.pos.x - x0, dz = p.pos.z - z0;
    return { dx: +dx.toFixed(2), dz: +dz.toFixed(2) };
  }, yaw, key, holdMs);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: findEdge(),
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--window-size=1280,720', '--mute-audio'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await startGame(page);

  const H = Math.PI / 2;
  const cases = [
    { yaw: 0, key: 'KeyW', want: 'z-' },
    { yaw: 0, key: 'KeyS', want: 'z+' },
    { yaw: H, key: 'KeyW', want: 'x-' },   // 面向 -x，前进应 x 减
    { yaw: H, key: 'KeyD', want: 'z-' },   // 面向 -x，右移应 -z
    { yaw: -H, key: 'KeyW', want: 'x+' },  // 面向 +x，前进应 x 增
    { yaw: Math.PI, key: 'KeyW', want: 'z+' }, // 面向 +z，前进应 z 增
  ];
  let pass = 0;
  for (const c of cases) {
    const { dx, dz } = await moveProbe(page, c.yaw, c.key);
    const got = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'x+' : 'x-') : (dz > 0 ? 'z+' : 'z-');
    const ok = got === c.want;
    if (ok) pass++;
    console.log(`${ok ? 'PASS' : 'FAIL'} yaw=${c.yaw.toFixed(2)} ${c.key} want=${c.want} got=${got} (dx=${dx},dz=${dz})`);
  }
  console.log(`direction: ${pass}/${cases.length}`);

  // 真实键盘事件链路（keydown → keys → update）
  const kb = await moveProbeReal(page, browser);
  console.log('real-keyboard move:', kb);

  await page.screenshot({ path: path.join(OUT, '07-verify.png') });

  // ---- 手机模拟：触屏点按钮开始 ----
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page2.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page2.tap('#btn-survival');
  await page2.waitForFunction(() => {
    const l = document.getElementById('loading');
    return l && l.style.display === 'none';
  }, { timeout: 60000 });
  const m = await page2.evaluate(() => ({ state: window.game.state, y: Math.round(window.game.player.pos.y) }));
  console.log('mobile-start:', JSON.stringify(m));

  console.log('errors:', errors.length, errors.join(' | '));
  await browser.close();
  process.exit(errors.length || pass < cases.length ? 1 : 0);

  // 真实键盘：keydown 事件 → player.keys → 位移
  async function moveProbeReal() {
    await page.evaluate(() => { window.game.player.yaw = 0; window.game.player.pitch = 0; });
    const before = await page.evaluate(() => ({ z: window.game.player.pos.z }));
    await page.keyboard.down('KeyW');
    await new Promise(r => setTimeout(r, 900));
    await page.keyboard.up('KeyW');
    const after = await page.evaluate(() => ({ z: window.game.player.pos.z }));
    return { dz: +(after.z - before.z).toFixed(2), expect: 'negative' };
  }
})().catch(e => { console.error('VERIFY FAILED', e); process.exit(2); });
