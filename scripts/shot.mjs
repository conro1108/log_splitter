// Headless screenshot driver. Drives the game through window.__ls.strikeAt()
// to fill the woodpile, then shoots one frame. Cheap and watchdogged, per
// CLAUDE.md: software WebGL pegs a core, so do the least work possible.
//
//   node scripts/shot.mjs <url> <out.png> [rounds] [wide]
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'scratch-shot.png';
const rounds = Number(process.argv[4] ?? 6);
const wide = process.argv[5] === 'wide';

const watchdog = setTimeout(() => { console.error('watchdog'); process.exit(1); }, 150000);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: wide ? { width: 1180, height: 780 } : { width: 430, height: 780 },
  deviceScaleFactor: 1,
});
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERR', m.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction('!!window.__ls', null, { timeout: 15000 });

// Split several rounds. strikeAt aims in log-local coords; a fresh round faces
// spinOffset 0 so a few blows across the face reliably split and stack.
const startSplit = await page.evaluate(() => window.__ls.logsSplit);
const target = startSplit + rounds;
for (let i = 0; i < 400; i++) {
  const s = await page.evaluate(() => {
    const ls = window.__ls;
    if (ls.phase === 'idle') ls.strikeAt(Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.4);
    else if (ls.phase === 'stuck') ls.strikeAt(0);
    return ls.logsSplit;
  });
  if (s >= target) break;
  await page.waitForTimeout(160);
}

// let the last pieces settle onto the pile
await page.waitForTimeout(2500);

// optional: orbit the view by N degrees before shooting (a wheel turn)
const orbitDeg = Number(process.env.ORBIT ?? 0);
if (orbitDeg) {
  await page.evaluate((deltaY) => window.dispatchEvent(new WheelEvent('wheel', { deltaY })),
    (orbitDeg * Math.PI / 180) / 0.0035);
  await page.waitForTimeout(400);
}

await page.screenshot({ path: out });
await browser.close();
clearTimeout(watchdog);
console.log('wrote', out, 'logsSplit=', await Promise.resolve(startSplit + rounds));
