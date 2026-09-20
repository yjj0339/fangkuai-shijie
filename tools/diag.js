// 诊断：为什么出生点柱子异常
const path = require('path');
const puppeteer = require('puppeteer-core');

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
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: findChromiumBrowser(),
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--mute-audio'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 600 });
  await page.goto('http://localhost:5188/', { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.getElementById('btn-survival').click());
  await new Promise(r => setTimeout(r, 9000));
  const diag = await page.evaluate(() => {
    const g = window.game;
    const w = g.world;
    const h = w.heightAt(0, 0);
    const col = [];
    for (let y = 90; y > 0; y--) {
      const id = w.getBlock(0, y, 0);
      if (id) col.push(y + ':' + id);
    }
    return {
      seed: w.seed,
      h00: h,
      biome: w.biomeAt(0, 0),
      playerY: g.player.pos.y,
      spawn: g.player.spawn,
      column: col.slice(0, 30).join(' '),
    };
  });
  console.log(JSON.stringify(diag, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
