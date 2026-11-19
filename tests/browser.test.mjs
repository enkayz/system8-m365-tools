import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createPacket} from '../public/tools/permission-change-review/core.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '/home/hermes/projects/system8-m365-dashboard/node_modules/playwright');
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE || '/home/hermes/projects/system8-m365-dashboard/test-results/playwright-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const URL = process.env.TOOL_URL || 'http://127.0.0.1:3359/tools/permission-change-review/';
const APP = '11111111-1111-1111-1111-111111111111';
const GRAPH = '00000003-0000-0000-c000-000000000000';
const P1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const P2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const fixture = (permissions = [], extra = {}) => JSON.stringify({appId: APP, requiredResourceAccess: [{resourceAppId: GRAPH, resourceAccess: permissions}], ...extra});
const before = fixture([{id: P1, type: 'Scope'}, {id: P2, type: 'Scope'}]);
const after = fixture([{id: P1, type: 'Role'}, {id: P2, type: 'Scope'}]);
async function session(viewport = {width: 1440, height: 1000}) {
  const browser = await chromium.launch({executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process']});
  const context = await browser.newContext({viewport, acceptDownloads: true});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return {browser, context, page, errors};
}
async function compare(page) {
  await page.locator('#baseline').fill(before);
  await page.locator('#proposed').fill(after);
  await page.locator('#compare').click();
}

test('paste validation, same-app comparison, visible delta and clear work without stale results', async () => {
  const {browser, page, errors} = await session();
  try {
    const response = await page.goto(URL);
    assert.equal(response.status(), 200, 'tool route exists');
    assert.equal(await page.locator('#compare').isDisabled(), true);
    assert.equal(await page.locator('#download').isDisabled(), true);
    await page.locator('#baseline').fill('PRIVATE-INVALID');
    assert.match(await page.locator('#baseline-error').innerText(), /Invalid manifest/);
    assert.equal((await page.locator('body').innerText()).includes('PRIVATE-INVALID'), false);
    assert.equal(await page.locator('#compare').isDisabled(), true);
    await compare(page);
    assert.equal(await page.locator('#results').isVisible(), true);
    for (const id of ['added', 'removed', 'unchanged']) assert.equal(await page.locator(`#count-${id}`).innerText(), '1');
    assert.match(await page.locator('#added-list').innerText(), /Application.*Role/s);
    assert.match(await page.locator('#added-list').innerText(), /heightened human review/);
    assert.match(await page.locator('#removed-list').innerText(), /Delegated.*Scope/s);
    assert.match(await page.locator('#added-list').innerText(), /Microsoft Graph/);
    assert.match(await page.locator('#added-list').innerText(), /Unresolved permission name/);
    await page.locator('#proposed').fill('{}');
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('#download').isDisabled(), true);
    await page.locator('#proposed').fill(fixture([], {appId: '22222222-2222-2222-2222-222222222222'}));
    await page.locator('#compare').click();
    assert.match(await page.locator('#status').innerText(), /same appId/);
    assert.equal(await page.locator('#results').isVisible(), false);
    await compare(page);
    await page.locator('#clear').click();
    assert.equal(await page.locator('#baseline').inputValue(), '');
    assert.equal(await page.locator('#proposed').inputValue(), '');
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('#download').isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally {await browser.close();}
});

for (const viewport of [{width:1440,height:1000}, {width:390,height:844}, {width:320,height:740}]) {
  test(`keyboard workflow, export, custody and layout at ${viewport.width}px`, async () => {
    const {browser, context, page, errors} = await session(viewport);
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    try {
      await page.goto(URL);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.skip').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#baseline-file').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      await page.keyboard.insertText(before);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#proposed-file').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      await page.keyboard.insertText(after);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#compare').evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator('#compare').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#results-heading').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Tab');
      await page.keyboard.insertText('Synthetic keyboard review');
      const packet = await packetDownload(page);
      assert.equal(packet.decisions[0].decision, 'Justified');
      assert.equal(packet.decisions[0].reason, 'Synthetic keyboard review');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow');
      await page.screenshot({path: `receipts/2026-11-19/build-review-${viewport.width}.png`, fullPage:true});
      assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0,0]);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(await page.evaluate(() => indexedDB.databases()), []);
      assert.deepEqual(await page.evaluate(() => caches.keys()), []);
      assert.deepEqual(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(x => x.map(r => r.scope))), []);
      const expected = [URL, ...['style.css','app.mjs','core.mjs'].map(path => URL+path)];
      assert.deepEqual([...new Set(requests)].sort(), expected.sort(), 'only static assets requested');
      await page.reload();
      assert.equal(await page.locator('#baseline').inputValue(), '');
      assert.equal(await page.locator('#download').isDisabled(), true);
      assert.deepEqual(errors, []);
    } finally {await browser.close();}
  });
}

async function packetDownload(page) {
  const pending = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await pending;
  assert.equal(download.suggestedFilename(), 'permission-change-review.json');
  assert.equal(await download.failure(), null);
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}

test('review decisions and bounded reasons export only on explicit action and edits erase review', async () => {
  const {browser, page, errors} = await session();
  try {
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.goto(URL);
    await compare(page);
    assert.equal(await page.locator('#download').isEnabled(), true);
    assert.equal(downloads, 0);
    const added = page.locator('#added-list li');
    const removed = page.locator('#removed-list li');
    await added.getByLabel('Review decision').selectOption('Justified');
    const reason = '<img src=x onerror=globalThis.pwned=1> Owner review';
    await added.getByLabel('Review reason').fill(reason);
    await removed.getByLabel('Review decision').selectOption('Reject');
    await removed.getByLabel('Review reason').fill('Keep existing delegated configuration.');
    assert.equal(await added.getByLabel('Review reason').getAttribute('maxlength'), '2000');
    const packet = await packetDownload(page);
    assert.deepEqual(packet, createPacket(before, after, [
      {key: GRAPH+'|Role|'+P1, decision: 'Justified', reason},
      {key: GRAPH+'|Scope|'+P1, decision: 'Reject', reason: 'Keep existing delegated configuration.'}
    ]));
    assert.equal(await page.evaluate(() => globalThis.pwned), undefined);
    await page.locator('#baseline').fill(before+' ');
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('#download').isDisabled(), true);
    await page.locator('#compare').click();
    assert.equal(await added.getByLabel('Review decision').inputValue(), 'Review needed');
    assert.equal(await added.getByLabel('Review reason').inputValue(), '');
    assert.equal(downloads, 1);
    await page.locator('#clear').click();
    assert.equal(await page.locator('[data-review]').count(), 0);
    assert.deepEqual(errors, []);
  } finally {await browser.close();}
});

test('archive navigation and discreet source link are available without referrer leakage', async () => {
  const {browser, page} = await session();
  try {
    await page.goto(URL);
    assert.equal(await page.getByRole('link', {name: 'All tools'}).getAttribute('href'), '/tools/');
    assert.equal(await page.getByRole('link', {name: 'Source'}).getAttribute('href'), 'https://github.com/enkayz/system8-m365-tools/tree/main/public/tools/permission-change-review');
    assert.equal(await page.locator('meta[name="referrer"]').getAttribute('content'), 'no-referrer');
    const contrast = await page.locator('header a').evaluate(el => {
      const luminance = rgb => {
        const channels = rgb.match(/\d+/g).slice(0,3).map(Number).map(c => {const v=c/255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4;});
        return channels[0]*.2126 + channels[1]*.7152 + channels[2]*.0722;
      };
      const a = luminance(getComputedStyle(el).color);
      const b = luminance(getComputedStyle(el.closest('header')).backgroundColor);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
    assert.ok(contrast >= 4.5, `header link contrast ${contrast}`);
  } finally {await browser.close();}
});

const file = (text, name = 'synthetic-manifest.json') => ({name, mimeType: 'application/json', buffer: Buffer.from(text)});
test('local files compare, replace pasted input, disclose duplicates and clear file selection', async () => {
  const {browser, page, errors} = await session();
  try {
    await page.goto(URL);
    await page.locator('#baseline-file').setInputFiles(file(before));
    await page.locator('#proposed-file').setInputFiles(file(after));
    await page.waitForFunction(() => !document.getElementById('compare').disabled);
    assert.equal(await page.locator('#baseline').inputValue(), before);
    await page.locator('#compare').click();
    await page.locator('#added-list select').selectOption('Reject');
    await page.locator('#baseline-file').setInputFiles(file(after));
    await page.waitForFunction(() => document.getElementById('baseline').value === document.getElementById('proposed').value);
    assert.equal(await page.locator('#download').isDisabled(), true);
    assert.equal(await page.locator('#results').isVisible(), false);
    await page.locator('#compare').click();
    assert.equal(await page.locator('#count-added').innerText(), '0');
    assert.equal(await page.locator('#count-unchanged').innerText(), '2');
    const duplicate = fixture([{id:P1,type:'Scope'},{id:P1,type:'Scope'}]);
    await page.locator('#baseline').fill(duplicate);
    await page.locator('#proposed').fill(fixture([]));
    await page.locator('#compare').click();
    assert.match(await page.locator('#duplicates').innerText(), /Baseline: 1 duplicate permissions/);
    assert.equal(await page.locator('#count-removed').innerText(), '1');
    await page.locator('#clear').click();
    assert.equal(await page.locator('#baseline-file').inputValue(), '');
    assert.equal(await page.locator('#proposed-file').inputValue(), '');
    assert.deepEqual(errors, []);
  } finally {await browser.close();}
});

test('oversize, malformed and failed file reads fail closed without stale export or leaked content', async () => {
  const {browser, page, errors} = await session();
  try {
    await page.goto(URL); await compare(page);
    await page.locator('#baseline-file').setInputFiles(file('x'.repeat(1048577)));
    assert.equal(await page.locator('#download').isDisabled(), true);
    assert.match(await page.locator('#baseline-error').innerText(), /1 MiB/);
    assert.equal(await page.locator('#baseline').inputValue(), '');
    await page.locator('#proposed').fill(after+' ');
    assert.match(await page.locator('#baseline-error').innerText(), /1 MiB/);
    await page.locator('#baseline-file').setInputFiles(file('PRIVATE-BAD-JSON'));
    await page.waitForFunction(() => document.getElementById('baseline-error').textContent.includes('Invalid manifest'));
    assert.equal((await page.locator('body').innerText()).includes('PRIVATE-BAD-JSON'), false);
    await page.evaluate(() => {File.prototype.text = async () => {throw Error('PRIVATE-FILE-ERROR');};});
    await page.locator('#baseline-file').setInputFiles(file(before));
    await page.waitForFunction(() => document.getElementById('baseline-error').textContent.includes('Could not read'));
    assert.equal((await page.locator('body').innerText()).includes('PRIVATE-FILE-ERROR'), false);
    assert.equal(await page.locator('#compare').isDisabled(), true);
    assert.equal(await page.locator('#download').isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally {await browser.close();}
});

test('file read races cannot restore cleared, edited or replaced manifests', async () => {
  const {browser, page, errors} = await session();
  try {
    await page.goto(URL);
    await page.evaluate(() => {
      globalThis.pendingReads = [];
      File.prototype.text = function() {return new Promise((resolve, reject) => pendingReads.push({resolve, reject}));};
    });
    await page.locator('#baseline-file').setInputFiles(file(before));
    await page.waitForFunction(() => pendingReads.length === 1);
    assert.equal(await page.locator('#baseline').getAttribute('aria-busy'), 'true');
    assert.match(await page.locator('#status').innerText(), /Reading baseline/);
    assert.equal(await page.locator('#compare').isDisabled(), true);
    await page.locator('#clear').click();
    assert.equal(await page.locator('#baseline').getAttribute('aria-busy'), 'false');
    await page.evaluate(value => pendingReads[0].resolve(value), before);
    assert.equal(await page.locator('#baseline').inputValue(), '');
    await page.locator('#baseline-file').setInputFiles(file(before));
    await page.waitForFunction(() => pendingReads.length === 2);
    await page.locator('#baseline').fill(after);
    await page.evaluate(value => pendingReads[1].resolve(value), before);
    assert.equal(await page.locator('#baseline').inputValue(), after);
    await page.locator('#baseline-file').setInputFiles(file(before));
    await page.waitForFunction(() => pendingReads.length === 3);
    await page.locator('#baseline-file').setInputFiles(file(after, 'replacement.json'));
    await page.waitForFunction(() => pendingReads.length === 4);
    await page.evaluate(value => pendingReads[3].resolve(value), after);
    await page.waitForFunction(value => document.getElementById('baseline').value === value, after);
    await page.evaluate(() => pendingReads[2].reject(Error('PRIVATE-OLD-ERROR')));
    assert.equal(await page.locator('#baseline').inputValue(), after);
    assert.equal(await page.locator('#baseline-error').innerText(), '');
    assert.deepEqual(errors, []);
  } finally {await browser.close();}
});
