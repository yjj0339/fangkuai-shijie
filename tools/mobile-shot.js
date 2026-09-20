// 手机宽度（390x844）触屏模式截图：标题屏 + 游戏内
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
const PAGE_URL = 'https://yjj0339.github.io/fangkuai-shijie/';
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: findEdge(),
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--mute-audio'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, 'm1-title.png') });

  await page.evaluate(() => document.getElementById('btn-survival').click());
  try {
    await page.waitForFunction(() => {
      const l = document.getElementById('loading');
      return l && l.style.display === 'none';
    }, { timeout: 60000 });
  } catch (e) { console.log('load timeout'); }
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: path.join(OUT, 'm2-game.png') });
  const info = await page.evaluate(() => ({
    touch: document.body.classList.contains('touch'),
    state: window.game.state,
    y: Math.round(window.game.player.pos.y),
    chunks: window.game.world.chunks.size,
  }));
  console.log('MOBILE INFO', JSON.stringify(info), 'errors:', errs.length);
  if (errs.length) console.log(errs.join('\n'));
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
