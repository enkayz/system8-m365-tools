import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require('/home/hermes/projects/system8-m365-dashboard/node_modules/playwright');
const executablePath='/home/hermes/projects/system8-m365-dashboard/test-results/playwright-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const URL=process.env.PATH_BUDGET_TOOL_URL||'http://127.0.0.1:3362/tools/sharepoint-path-budget/';
async function session(width=1440){const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});const page=await context.newPage();const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));return {browser,context,page,errors,requests};}
async function check(page,text='Docs\nDocs/a.txt\ndocs/A.txt\n=SUM(1,2).txt\n<img src=x onerror=alert(1)>'){await page.locator('#root-a').fill('sites/A/Docs');await page.locator('#root-b').fill('s/D');await page.locator('#paths').fill(text);await page.locator('#check').click();}
async function download(page,id){const pending=page.waitForEvent('download');await page.locator(id).click();const d=await pending;assert.equal(await d.failure(),null);return readFile(await d.path(),'utf8');}
const file=(text,name='synthetic-paths.txt')=>({name,mimeType:'text/plain',buffer:Buffer.from(text)});
test('strict txt UTF-8 import limits and generation races invalidate exports and preserve current inputs',async()=>{
 const {browser,page,errors}=await session();try{
 await page.goto(URL);await check(page);await page.locator('#path-file').setInputFiles(file('one.txt\ntwo.txt'));await page.waitForFunction(()=>document.getElementById('paths').value==='one.txt\ntwo.txt');assert.equal(await page.locator('#download-json').isDisabled(),true);await page.locator('#check').click();assert.equal(await page.locator('#rows tr').count(),2);
 for(const [payload,pattern] of [[file('a'.repeat(1048577)),/1 MiB/],[{name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from([0xc3,0x28])},/UTF-8/],[file('x','bad.csv'),/\.txt/],[file('a\n'.repeat(5001)),/5,000/],[file('../escape'),/Line 1/]]){
 await page.locator('#path-file').setInputFiles(payload);await page.waitForFunction(()=>document.getElementById('error').textContent.length>0);assert.match(await page.locator('#error').innerText(),pattern);assert.equal(await page.locator('#paths').inputValue(),'one.txt\ntwo.txt');assert.equal(await page.locator('#download-json').isDisabled(),true);assert.equal(await page.locator('#check').isDisabled(),true);
 }
 await page.evaluate(()=>{globalThis.pending=[];File.prototype.arrayBuffer=function(){return new Promise((resolve,reject)=>pending.push({resolve,reject}));};});
 await page.locator('#path-file').setInputFiles(file('old'));await page.waitForFunction(()=>pending.length===1);assert.equal(await page.locator('#check').isDisabled(),true);assert.equal(await page.locator('#paths').getAttribute('aria-busy'),'true');await page.locator('#paths').fill('typed.txt');await page.evaluate(()=>pending[0].resolve(new TextEncoder().encode('old.txt').buffer));assert.equal(await page.locator('#paths').inputValue(),'typed.txt');assert.equal(await page.locator('#check').isDisabled(),false);
 await page.locator('#path-file').setInputFiles(file('old'));await page.waitForFunction(()=>pending.length===2);await page.locator('#path-file').setInputFiles(file('new','new.txt'));await page.waitForFunction(()=>pending.length===3);await page.evaluate(()=>pending[2].resolve(new TextEncoder().encode('new.txt').buffer));await page.waitForFunction(()=>document.getElementById('paths').value==='new.txt');await page.evaluate(()=>pending[1].reject(Error('PRIVATE-OLD-ERROR')));assert.equal(await page.locator('#error').innerText(),'');
 await page.locator('#path-file').setInputFiles(file('old'));await page.waitForFunction(()=>pending.length===4);await page.locator('#clear').click();await page.evaluate(()=>pending[3].resolve(new TextEncoder().encode('old.txt').buffer));assert.equal(await page.locator('#paths').inputValue(),'');
 await page.locator('#path-file').setInputFiles(file('old'));await page.waitForFunction(()=>pending.length===5);await page.evaluate(()=>pending[4].reject(Error('PRIVATE-READ-ERROR')));await page.waitForFunction(()=>document.getElementById('error').textContent.includes('Could not read'));assert.equal((await page.locator('body').innerText()).includes('PRIVATE-'),false);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
for(const width of [1440,390,320])test(`complete keyboard A/B review and explicit handoff at ${width}px`,async()=>{
 const {browser,context,page,errors,requests}=await session(width);let downloads=0;page.on('download',()=>downloads++);
 try{
  const response=await page.goto(URL);assert.equal(response.status(),200);assert.equal(await page.locator('#check').isDisabled(),true);
  await page.keyboard.press('Tab');assert.equal(await page.locator('.skip').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');await page.keyboard.press('Tab');assert.equal(await page.locator('#root-a').evaluate(e=>e===document.activeElement),true);
  await check(page);assert.equal(await page.locator('#results-heading').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('#rows tr').count(),5);assert.equal(await page.locator('#rows img').count(),0);assert.equal(downloads,0);
  await page.locator('#filter').selectOption('review');assert.equal(await page.locator('#rows tr').count(),3);
  const json=await download(page,'#download-json'),packet=JSON.parse(json);assert.equal(packet.rows.length,5);assert.deepEqual(packet.rows[1].caseLines,[3]);const csv=await download(page,'#download-csv');assert.match(csv,/"'=SUM\(1,2\).txt"/);if(width===1440){await writeFile('receipts/2026-11-22/build-handoff.json',json);await writeFile('receipts/2026-11-22/build-handoff.csv',csv);}
  await page.locator('#filter').selectOption('all');assert.equal(await page.locator('.table-wrap').getAttribute('tabindex'),'0');await page.locator('.table-wrap').focus();await page.keyboard.press('ArrowRight');if(width<1000)await page.waitForFunction(()=>document.querySelector('.table-wrap').scrollLeft>0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`receipts/2026-11-22/build-path-budget-${width}.png`,fullPage:true});
  await page.locator('#root-a').fill('/invalid');assert.equal(await page.locator('#download-json').isDisabled(),true);assert.equal(await page.locator('#results').isVisible(),false);assert.match(await page.locator('#error').innerText(),/prefix A/);assert.equal(await page.locator('#paths').inputValue(),packet.rows.map(r=>r.path).join('\n'));
  await check(page,'x'.repeat(387)+'\n'+'x'.repeat(388));assert.match(await page.locator('#summary').innerText(),/A over budget: 1/);assert.match(await page.locator('#summary').innerText(),/Resolved by B: 1/);
  await page.locator('#root-b').fill('');await page.locator('#check').click();assert.equal(JSON.parse(await download(page,'#download-json')).rows[0].b,null);
  assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);assert.deepEqual(await context.cookies(),[]);assert.deepEqual(await page.evaluate(()=>indexedDB.databases()),[]);assert.deepEqual(await page.evaluate(()=>caches.keys()),[]);assert.deepEqual(await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(a=>a.map(x=>x.scope))),[]);
  assert.deepEqual([...new Set(requests)].sort(),[URL,URL+'style.css',URL+'core.mjs',URL+'app.mjs'].sort());
  await page.locator('#clear').click();assert.equal(await page.locator('#paths').inputValue(),'');assert.equal(await page.locator('#root-a').inputValue(),'');await check(page);await page.reload();assert.equal(await page.locator('#paths').inputValue(),'');assert.equal(await page.locator('#download-json').isDisabled(),true);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
