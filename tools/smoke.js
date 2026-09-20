/**
 * 本地开发冒烟测试（只连本机 http://localhost:5188 页面，不执行任何系统命令）
 * 用法：node tools/smoke.js
 * 输出：shots/*.png 截图 + 页面报错汇总，退出码非 0 = 有页面错误
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core'); // 由上层 node_modules 解析

// 在本机常见安装位置查找 Edge 浏览器可执行文件
function findChromiumBrowser() {
  const candidates = [
    ['C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
    ['C:', 'Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
  ];
  for (const parts of candidates) {
    const candidate = parts.join(path.sep);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const PAGE_URL = 'http://localhost:5188/';
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: findChromiumBrowser(),
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--window-size=1280,720', '--mute-audio'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('[console] ' + m.text());
  });

  await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, '01-title.png') });

  // 点"新的世界·生存"
  const hasBtn = await page.evaluate(() => {
    const b = document.getElementById('btn-survival');
    if (!b) return false;
    b.click();
    return true;
  });
  console.log('startGame clicked:', hasBtn);

  // 等待世界生成完毕（loading 消失，最多 40s）
  try {
    await page.waitForFunction(() => {
      const l = document.getElementById('loading');
      return l && l.style.display === 'none';
    }, { timeout: 40000 });
    console.log('world ready');
  } catch (e) {
    console.log('TIMEOUT waiting world ready; state=', await page.evaluate(() => window.game && game.state));
  }
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(OUT, '02-ingame.png') });

  // 状态采样
  const info = await page.evaluate(() => {
    if (!window.game) return null;
    const g = window.game;
    return {
      state: g.state,
      chunks: g.world ? g.world.chunks.size : 0,
      meshes: g.meshCache ? g.meshCache.size : 0,
      pos: g.player ? g.player.pos : null,
      hp: g.player ? g.player.hp : null,
      entities: g.entities ? g.entities.list.length : 0,
      fps: g.fps,
    };
  });
  console.log('INFO', JSON.stringify(info));

  // 挖掘核心逻辑验证（挖脚前方的地表方块）
  const dig = await page.evaluate(() => {
    const g = window.game;
    if (!g || !g.world) return null;
    const p = g.player;
    const x = Math.floor(p.pos.x) + 1, z = Math.floor(p.pos.z) + 2;
    const y = g.world.heightAt(x, z);
    const before = g.world.getBlock(x, y, z);
    g.interact.breakBlock(x, y, z, true);
    const after = g.world.getBlock(x, y, z);
    return { before, after, drops: g.entities.list.filter(e => e.kind === 'drop').length };
  });
  console.log('DIG', JSON.stringify(dig));

  // 快进到夜晚看天空/星星
  await page.evaluate(() => { window.game.sky.timeOfDay = 0.56; });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, '03-night.png') });

  // TNT 爆炸测试（放在玩家正前方 5 格，视野内）
  const tnt = await page.evaluate(() => {
    const g = window.game;
    const p = g.player;
    p.yaw = 0; p.pitch = -0.15; // 看向 -z
    const x = Math.floor(p.pos.x), z = Math.floor(p.pos.z) - 5;
    const y = g.world.heightAt(x, z);
    g.world.setBlock(x, y + 1, z, 21);
    g.entities.primeTNT(x, y + 1, z, 0.35);
    return { x, y: y + 1, z };
  });
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, '04-tnt.png') });
  await new Promise(r => setTimeout(r, 2200));
  console.log('TNT primed at', JSON.stringify(tnt));

  // 给物品并打开背包（验证图标与界面）
  await page.evaluate(() => {
    const g = window.game;
    [1, 3, 5, 21, 19, 10].forEach(id => g.player.addItem(id, 32));
    g.sky.timeOfDay = 0.12;
    g.ui.openInventory();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT, '05-inventory.png') });
  await page.evaluate(() => { window.game.ui.closeInventory(); });

  // 白天手持方块视角
  await page.evaluate(() => {
    const g = window.game;
    g.player.selected = 0;
    g.player.yaw = 0.6; g.player.pitch = 0.05;
    g.player.updateHeldMesh(true);
    g.sky.timeOfDay = 0.12;
  });
  await new Promise(r => setTimeout(r, 2200));
  await page.screenshot({ path: path.join(OUT, '06-day-held.png') });

  console.log('\n===== ERRORS (' + errors.length + ') =====');
  for (const e of errors) console.log(e);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('SMOKE FAILED', e); process.exit(2); });
