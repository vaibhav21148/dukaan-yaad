// Renders public/icons/icon.svg to PNGs with Playwright's Chromium (dev-only helper).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icons/icon.svg', 'utf8');
const browser = await chromium.launch();
for (const [size, name, pad] of [[192, 'icon-192.png', 0], [512, 'icon-512.png', 0], [512, 'maskable-512.png', 56]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = size - pad * 2;
  await page.setContent(`<html><body style="margin:0;background:#b3122c;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}` });
  await page.close();
}
await browser.close();
console.log('icons written');
