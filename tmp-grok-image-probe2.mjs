import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const prompt = 'tiny blue square icon';
const raw = JSON.parse(await fs.readFile('./cookiestest/grok.json', 'utf8'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', locale: 'en-US' });
const cookies = raw.map((cookie) => ({ name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path || '/', expires: typeof cookie.expirationDate === 'number' ? cookie.expirationDate : (typeof cookie.expires === 'number' ? cookie.expires : undefined), httpOnly: Boolean(cookie.httpOnly), secure: Boolean(cookie.secure), sameSite: cookie.sameSite === 'no_restriction' ? 'None' : cookie.sameSite === 'lax' ? 'Lax' : cookie.sameSite === 'strict' ? 'Strict' : undefined })).filter((cookie) => cookie.name && cookie.value && cookie.domain);
await context.addCookies(cookies);
const seen = new Set();
const page = await context.newPage();
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('assets.grok.com') && url.includes('/generated/') && !seen.has(url)) {
    seen.add(url);
    console.log('asset', response.status(), url);
  }
});
await page.goto('https://grok.com/imagine', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(5000);
const editor = page.locator('[contenteditable="true"]').first();
await editor.click();
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
await page.keyboard.press('Backspace').catch(() => {});
await page.keyboard.type(prompt, { delay: 10 });
await page.locator('button[aria-label="Submit"]').last().click({ force: true });
for (const ms of [5000, 15000, 30000, 60000]) {
  await page.waitForTimeout(ms === 5000 ? ms : ms - (ms === 15000 ? 5000 : ms === 30000 ? 15000 : 30000));
  const info = await page.evaluate(() => {
    const values = Array.from(document.querySelectorAll('img'), (node) => node.getAttribute('src') || '').filter((src) => src.includes('/generated/') || src.startsWith('data:image/'));
    return Array.from(new Set(values)).slice(-10);
  });
  console.log('dom', ms, JSON.stringify(info));
}
await browser.close();
