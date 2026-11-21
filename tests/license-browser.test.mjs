import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '/home/hermes/projects/system8-m365-dashboard/node_modules/playwright');
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE || '/home/hermes/projects/system8-m365-dashboard/test-results/playwright-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const URL = process.env.LICENSE_TOOL_URL || 'http://127.0.0.1:3361/tools/license-assignment-reconcile/';
// Synthetic fixtures only: no production/customer records.
const expected = 'UserPrincipalName,SkuId\na@example.com,E3\n-b@example.com,-SKU\na@example.com,E3';
const observed = 'UserPrincipalName,SkuId\na@example.com,E3\nc@example.com,E5';
async function session(width=1440) {
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
 const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 return {browser,context,page,errors};
}
async function compare(page) {
 await page.locator('#expected').fill(expected); await page.locator('#observed').fill(observed);
 await page.locator('#scope').check(); await page.locator('#compare').click();
}
async function download(page,id) {
 const pending=page.waitForEvent('download');await page.locator(id).click(); const d=await pending;
 assert.equal(await d.failure(),null);return readFile(await d.path(),'utf8');
}
test('narrow results preserve identifier reading order and keyboard-scrollable table region',async()=>{
 const {browser,page}=await session(320);
 try {
  await page.goto(URL);await compare(page);
  assert.equal(await page.locator('.table-wrap').getAttribute('tabindex'),'0');
  assert.equal(await page.locator('th').first().evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');
  await page.locator('.table-wrap').focus();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('.table-wrap').scrollLeft>0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('.scope').evaluate(e=>e.getBoundingClientRect().height>=44),true);
  assert.equal(await page.locator('#expected-file').evaluate(e=>parseFloat(getComputedStyle(e,'::file-selector-button').minHeight)>=44),true);
 }finally{await browser.close();}
});
const file = (text,name='synthetic-assignments.csv') => ({name,mimeType:'text/csv',buffer:Buffer.from(text)});
test('file import, bounded strict UTF-8 failures and stale async completions preserve current intent',async()=>{
 const {browser,page,errors}=await session();
 try {
  await page.goto(URL);await compare(page);
  await page.locator('#expected-file').setInputFiles(file(observed));
  await page.waitForFunction(value=>document.getElementById('expected').value===value,observed);
  assert.equal(await page.locator('#download-json').isDisabled(),true);
  await page.locator('#compare').click();assert.equal(await page.locator('#rows tr').count(),2);
  await page.locator('#expected-file').setInputFiles(file('x'.repeat(1048577)));
  assert.match(await page.locator('#expected-error').innerText(),/1 MiB/);
  assert.equal(await page.locator('#expected').inputValue(),observed);
  assert.equal(await page.locator('#download-json').isDisabled(),true);
  await page.locator('#observed').fill(observed+'\n');assert.match(await page.locator('#expected-error').innerText(),/1 MiB/);
  await page.locator('#expected-file').setInputFiles({name:'synthetic-invalid-utf8.csv',mimeType:'text/csv',buffer:Buffer.from([0xc3,0x28])});
  await page.waitForFunction(()=>document.getElementById('expected-error').textContent.includes('UTF-8'));
  assert.equal(await page.locator('#expected').inputValue(),observed);
  await page.locator('#expected-file').setInputFiles(file('UserPrincipalName,SkuId,Secret\na@example.com,E3,PRIVATE'));
  await page.waitForFunction(()=>document.getElementById('expected-error').textContent.includes('headers'));
  assert.equal(await page.locator('#expected').inputValue(),observed);
  await page.evaluate(()=>{globalThis.pending=[];File.prototype.arrayBuffer=function(){return new Promise((resolve,reject)=>pending.push({resolve,reject}));};});
  await page.locator('#expected-file').setInputFiles(file(expected));await page.waitForFunction(()=>pending.length===1);
  assert.equal(await page.locator('#expected').getAttribute('aria-busy'),'true');assert.equal(await page.locator('#compare').isDisabled(),true);
  await page.locator('#clear').click();await page.evaluate(text=>pending[0].resolve(new TextEncoder().encode(text).buffer),expected);
  assert.equal(await page.locator('#expected').inputValue(),'');
  await page.locator('#expected-file').setInputFiles(file(expected));await page.waitForFunction(()=>pending.length===2);
  await page.locator('#expected').fill(observed);await page.evaluate(text=>pending[1].resolve(new TextEncoder().encode(text).buffer),expected);
  assert.equal(await page.locator('#expected').inputValue(),observed);
  await page.locator('#expected-file').setInputFiles(file(expected));await page.waitForFunction(()=>pending.length===3);
  await page.locator('#expected-file').setInputFiles(file(observed,'synthetic-replacement.csv'));await page.waitForFunction(()=>pending.length===4);
  await page.evaluate(text=>pending[3].resolve(new TextEncoder().encode(text).buffer),observed);
  await page.waitForFunction(()=>document.getElementById('expected').getAttribute('aria-busy')==='false');
  await page.evaluate(()=>pending[2].reject(Error('PRIVATE-OLD-ERROR')));
  assert.equal(await page.locator('#expected').inputValue(),observed);assert.equal(await page.locator('#expected-error').innerText(),'');
  await page.locator('#expected-file').setInputFiles(file(expected));await page.waitForFunction(()=>pending.length===5);
  await page.evaluate(()=>pending[4].reject(Error('PRIVATE-ERROR')));
  await page.waitForFunction(()=>document.getElementById('expected-error').textContent.includes('Could not read'));
  assert.equal(await page.locator('#expected').inputValue(),observed);assert.equal((await page.locator('body').innerText()).includes('PRIVATE-ERROR'),false);
  assert.equal(await page.locator('#compare').isDisabled(),true);assert.deepEqual(errors,[]);
 } finally {await browser.close();}
});
for (const width of [1440,390,320]) test(`keyboard compare, filter, explicit downloads, clear and custody at ${width}px`,async()=>{
 const {browser,context,page,errors}=await session(width);const requests=[];let downloads=0;
 page.on('request',r=>requests.push(r.url()));page.on('download',()=>downloads++);
 try {
  const response=await page.goto(URL);assert.equal(response.status(),200);
  assert.equal(await page.locator('#compare').isDisabled(),true);
  await page.keyboard.press('Tab');assert.equal(await page.locator('.skip').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Enter');await page.keyboard.press('Tab');
  assert.equal(await page.locator('#expected-file').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Tab');await page.keyboard.insertText(expected);
  await page.keyboard.press('Tab');assert.equal(await page.locator('#observed-file').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Tab');await page.keyboard.insertText(observed);
  assert.equal(await page.locator('#compare').isDisabled(),true);
  await page.keyboard.press('Tab');await page.keyboard.press('Space');await page.keyboard.press('Tab');
  assert.equal(await page.locator('#compare').evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('#compare').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#results-heading').evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('#rows tr').count(),3);assert.match(await page.locator('#duplicates').innerText(),/Expected: 3 rows, 2 unique pairs, 1 duplicate/);
  assert.equal(downloads,0);
  await page.locator('#filter').selectOption('Expected only');assert.equal(await page.locator('#rows tr').count(),1);
  const packet=JSON.parse(await download(page,'#download-json'));assert.equal(packet.rows.length,3);assert.equal(packet.counts['In both'],1);
  assert.match(await download(page,'#download-csv'),/"'-b@example.com","'-SKU"/);
  await page.locator('#observed').fill('PRIVATE-INVALID');
  assert.equal(await page.locator('#results').isVisible(),false);assert.equal(await page.locator('#download-json').isDisabled(),true);
  assert.match(await page.locator('#observed-error').innerText(),/headers/);
  assert.equal(await page.locator('#observed').inputValue(),'PRIVATE-INVALID');
  assert.equal((await page.locator('body').innerText()).includes('PRIVATE-INVALID'),false);
  await compare(page);await page.locator('#scope').uncheck();assert.equal(await page.locator('#download-csv').isDisabled(),true);
  await compare(page);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`receipts/2026-11-21/build-license-${width}.png`,fullPage:true});
  assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);
  assert.deepEqual(await context.cookies(),[]);assert.deepEqual(await page.evaluate(()=>indexedDB.databases()),[]);
  assert.deepEqual(await page.evaluate(()=>caches.keys()),[]);assert.deepEqual(await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(a=>a.map(r=>r.scope))),[]);
  assert.deepEqual([...new Set(requests)].sort(),[URL,URL+'app.mjs',URL+'core.mjs',URL+'style.css',new globalThis.URL('../permission-change-review/style.css',URL).href].sort());
  await page.locator('#clear').click();assert.equal(await page.locator('#expected').inputValue(),'');assert.equal(await page.locator('#scope').isChecked(),false);
  await compare(page);await page.reload();assert.equal(await page.locator('#expected').inputValue(),'');assert.equal(await page.locator('#download-json').isDisabled(),true);
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
});
