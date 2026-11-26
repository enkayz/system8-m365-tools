import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/hermes/projects/system8-m365-dashboard/node_modules/playwright');
const executablePath=process.env.PLAYWRIGHT_EXECUTABLE||'/home/hermes/projects/system8-m365-dashboard/test-results/playwright-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const url=process.env.CHANGE_WINDOW_TOOL_URL||'http://127.0.0.1:3370/tools/change-window-review/';
const evidence=process.env.CHANGE_WINDOW_EVIDENCE_DIR;
assert.ok(evidence&&isAbsolute(evidence),'Set CHANGE_WINDOW_EVIDENCE_DIR to an absolute build-* evidence directory');
await mkdir(evidence,{recursive:true});
async function open(t,width=1440){const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});t.after(()=>browser.close());return browser.newPage({viewport:{width,height:1000},acceptDownloads:true});}
async function fill(page){await page.locator('#start').fill('2026-11-26T00:30Z');await page.locator('#execution').fill('60');await page.locator('#rollback').fill('30');}
test('browser timezone rules preserve DST repeated and skipped hours',async t=>{
 const page=await open(t);await page.goto(url);
 for(const [start,execution,rollback,workStart,workEnd,expectedExecution,expectedRollback,firstOffset,lastOffset] of [['2026-03-08T06:00Z','120','30','01:30','03:30',60,0,'UTC-05:00','UTC-04:00'],['2026-11-01T05:00Z','60','60','01:00','02:00',60,60,'UTC-04:00','UTC-05:00']]){
  await page.locator('#clear').click();await page.locator('#start').fill(start);await page.locator('#execution').fill(execution);await page.locator('#rollback').fill(rollback);await page.locator('.site-zone').fill('America/New_York');await page.locator('.work-start').fill(workStart);await page.locator('.work-end').fill(workEnd);for(const item of await page.locator('.weekdays input').all())await item.uncheck();await page.locator('.weekdays input[value="7"]').check();await page.locator('#review').click();assert.match(await page.locator('.execution-count').textContent(),new RegExp(expectedExecution+' of '+execution));assert.match(await page.locator('.rollback-count').textContent(),new RegExp(expectedRollback+' of '+rollback));assert.ok((await page.locator('.site-result').textContent()).includes(firstOffset));assert.ok((await page.locator('.site-result').textContent()).includes(lastOffset));
 }
});

test('UTC phase boundaries stay individually readable without splitting timestamps',async t=>{
 const page=await open(t,320);await page.goto(url);await fill(page);await page.locator('#review').click();assert.equal(await page.locator('.utc-boundary').count(),3);assert.deepEqual(await page.locator('.utc-boundary').allTextContents(),['2026-11-26T00:30Z','2026-11-26T01:30Z','2026-11-26T02:00Z']);for(const item of await page.locator('.utc-boundary').all())assert.equal(await item.evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});

test('desktop and mobile keyboard workflow, validation, exports and local custody regressions',async t=>{
 for(const width of [320,390,1440]){
  const page=await open(t,width);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await page.addInitScript(()=>{window.custodyCalls=[];for(const [object,key] of [[Storage.prototype,'setItem'],[window,'fetch'],[XMLHttpRequest.prototype,'open'],[navigator,'sendBeacon'],[IDBFactory.prototype,'open']]){object[key]=function(){window.custodyCalls.push(key);throw new Error('Unexpected content custody call');};}});
  await page.goto(url);await page.keyboard.press('Tab');assert.match(await page.locator(':focus').textContent(),/Skip to window/);assert.notEqual(await page.locator(':focus').evaluate(e=>getComputedStyle(e).outlineStyle),'none');await page.keyboard.press('Enter');await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'start');await page.keyboard.type('2026-11-26T00:30Z');
  await page.locator('#review').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#results').isVisible(),true);assert.equal(await page.locator('#results').evaluate(e=>e===document.activeElement),true);assert.match(await page.locator('.execution-count').textContent(),/30 of 60/);
  for(const ext of ['json','csv']){const pending=page.waitForEvent('download');await page.locator('#'+ext).focus();await page.keyboard.press('Enter');const d=await pending;const content=await readFile(await d.path(),'utf8');if(ext==='json')assert.equal(JSON.parse(content).rows.length,1);else assert.ok(content.includes('Australia/Perth'));}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('header a').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(evidence,'build-ui-'+width+'.png'),fullPage:true});
  await page.locator('.site-zone').fill('<img src=x onerror=alert(1)>');assert.equal(await page.locator('#json').isDisabled(),true);await page.locator('#review').click();assert.match(await page.locator('#error').textContent(),/IANA/);assert.equal(await page.locator('#error img').count(),0);assert.equal(await page.locator('#error').evaluate(e=>e===document.activeElement),true);
  await page.locator('#clear').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#start').inputValue(),'');assert.equal(await page.locator('#json').isDisabled(),true);
  assert.deepEqual(await page.evaluate(()=>window.custodyCalls),[]);assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.equal(await page.evaluate(()=>document.cookie),'');assert.equal(await page.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).length),0);assert.equal(await page.evaluate(async()=> (await caches.keys()).length),0);
  await page.reload();assert.equal(await page.locator('#start').inputValue(),'');assert.equal(await page.locator('#notes').inputValue(),'');assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'&&r.url.startsWith(url)&&!new URL(r.url).search));await writeFile(join(evidence,'build-custody-'+width+'.json'),JSON.stringify({errors,requests,unexpectedCustodyCalls:[]},null,2),{flag:'wx'});
 }
});

test('invalid browser inputs block every export without reflecting hostile text',async t=>{
 const page=await open(t);await page.goto(url);await fill(page);
 const changes=[['#start','2026-02-29T00:00Z',/UTC/],['#start','2026-11-26T00:30:00Z',/UTC/],['#execution','1.5',/whole minutes/],['#execution','1441',/1440/],['#rollback','-1',/whole minutes/],['.site-name','x'.repeat(81),/80/],['.site-zone','Mars/Olympus',/IANA/],['#notes','x'.repeat(1001),/1000/],['.work-end','08:00',/start before end/]];
 for(const [selector,value,message] of changes){await page.locator('#clear').click();await fill(page);await page.locator(selector).fill(value);await page.locator('#review').click();assert.equal(await page.locator('#results').isVisible(),false);assert.equal(await page.locator('#json').isDisabled(),true);assert.equal(await page.locator('#csv').isDisabled(),true);assert.match(await page.locator('#error').textContent(),message);}
 await page.locator('#clear').click();await fill(page);for(const input of await page.locator('.weekdays input').all())await input.uncheck();await page.locator('#review').click();assert.match(await page.locator('#error').textContent(),/working weekdays/);
});

test('clear resets the entire local handoff without retaining prior results',async t=>{
 const page=await open(t);await page.goto(url);assert.equal(await page.locator('#clear').count(),1,'Clear control exists');await fill(page);await page.locator('#notes').fill('Internal note');await page.locator('#add-site').click();await page.locator('#review').click();await page.locator('#clear').click();
 assert.equal(await page.locator('#start').inputValue(),'');assert.equal(await page.locator('#notes').inputValue(),'');assert.equal(await page.locator('#execution').inputValue(),'60');assert.equal(await page.locator('#rollback').inputValue(),'30');assert.equal(await page.locator('.site').count(),1);assert.equal(await page.locator('.site-name').inputValue(),'Site 1');assert.equal(await page.locator('.site-zone').inputValue(),'Australia/Perth');assert.equal(await page.locator('.weekdays input:checked').count(),5);assert.equal(await page.locator('#json').isDisabled(),true);assert.equal(await page.locator('#results').isVisible(),false);assert.equal(await page.locator('#error').isVisible(),false);assert.equal(await page.locator('#start').evaluate(e=>e===document.activeElement),true);
 await page.locator('#review').click();assert.match(await page.locator('#error').textContent(),/UTC/);assert.equal(await page.locator('#error').evaluate(e=>e===document.activeElement),true);await page.locator('#clear').click();assert.equal(await page.locator('#error').isVisible(),false);
});

test('downloads require explicit action, include every site and become unavailable on edit',async t=>{
 const page=await open(t);await page.goto(url);assert.equal(await page.locator('#json').count(),1,'JSON export control exists');assert.equal(await page.locator('#json').isDisabled(),true);
 let downloads=0;page.on('download',()=>downloads++);await fill(page);await page.locator('.site-name').fill('=1+1');await page.locator('#notes').fill('\t=HYPERLINK("example")\nInternal handoff');
 await page.locator('#add-site').click();await page.locator('.site-name').last().fill('<img src=x onerror=alert(1)>');await page.locator('.site-zone').last().fill('America/New_York');await page.locator('#review').click();assert.equal(downloads,0);assert.equal(await page.locator('#results img').count(),0);
 for(const ext of ['json','csv']){const pending=page.waitForEvent('download');await page.locator('#'+ext).click();const download=await pending;assert.equal(download.suggestedFilename(),'change-window-review.'+ext);const content=await readFile(await download.path(),'utf8');await writeFile(join(evidence,'build-export.'+ext),content,{flag:'wx'});if(ext==='json'){const data=JSON.parse(content);assert.equal(data.rows.length,2);assert.equal(data.input.sites.length,2);assert.equal(data.rows[1].name,'<img src=x onerror=alert(1)>');assert.equal(data.rows[0].executionOverlapMinutes,30);}else{assert.ok(content.includes('"\'=1+1"'));assert.ok(content.includes('"\'\t=HYPERLINK'));assert.ok(content.includes('America/New_York'));}}
 assert.equal(downloads,2);await page.locator('#notes').fill('Changed note');assert.equal(await page.locator('#json').isDisabled(),true);assert.equal(await page.locator('#csv').isDisabled(),true);await page.locator('#json').dispatchEvent('click');assert.equal(downloads,2);
 await page.locator('#review').click();await page.locator('#add-site').click();assert.equal(await page.locator('#csv').isDisabled(),true);await page.locator('#review').click();await page.getByRole('button',{name:'Remove site 3',exact:true}).click();assert.equal(await page.locator('#json').isDisabled(),true);
});

test('site lifecycle supports up to twenty schedules without retaining stale results',async t=>{
 const page=await open(t);await page.goto(url);assert.equal(await page.locator('#add-site').count(),1,'Add site control exists');await fill(page);await page.locator('#review').click();
 await page.locator('#add-site').click();assert.equal(await page.locator('.site').count(),2);assert.equal(await page.locator('#results').isVisible(),false);assert.equal(await page.locator('.site-name').last().evaluate(e=>e===document.activeElement),true);
 await page.locator('.site-zone').last().fill('UTC');await page.locator('.site-name').last().fill('Illustrative second site');await page.locator('#review').click();assert.equal(await page.locator('.site-result').count(),2);
 await page.getByRole('button',{name:'Remove site 1',exact:true}).click();assert.equal(await page.locator('.site').count(),1);assert.equal(await page.locator('.site-name').inputValue(),'Illustrative second site');assert.equal(await page.locator('#results').isVisible(),false);assert.equal(await page.getByRole('button',{name:'Remove site 1',exact:true}).isDisabled(),true);
 for(let i=1;i<20;i++)await page.locator('#add-site').click();assert.equal(await page.locator('.site').count(),20);assert.equal(await page.locator('#add-site').isDisabled(),true);await page.locator('#review').click();assert.equal(await page.locator('.site-result').count(),20);
 await page.getByRole('button',{name:'Remove site 20',exact:true}).click();assert.equal(await page.locator('#add-site').isDisabled(),false);assert.equal(await page.locator('#results').isVisible(),false);
});

test('editing any window or schedule input immediately withdraws stale review',async t=>{
 const page=await open(t);await page.goto(url);await fill(page);
 const changes=[['#start','2026-11-26T01:00Z'],['#execution','61'],['#rollback','31'],['#notes','Reference only'],['.site-name','Edited site'],['.site-zone','UTC'],['.work-start','08:30'],['.work-end','16:00']];
 for(const [selector,value] of changes){await page.locator('#review').click();assert.equal(await page.locator('#results').isVisible(),true);await page.locator(selector).fill(value);assert.equal(await page.locator('#results').isVisible(),false,selector);assert.equal(await page.locator('.site-result').count(),0);assert.match(await page.locator('#status').textContent(),/Review again/);}
 await page.locator('#review').click();await page.locator('.weekdays input').first().uncheck();assert.equal(await page.locator('#results').isVisible(),false);
 await page.locator('#start').fill('bad');await page.locator('#execution').focus();assert.equal(await page.locator('#error').isVisible(),true);assert.match(await page.locator('#error').textContent(),/UTC/);await page.locator('#start').fill('2026-11-26T01:00Z');assert.equal(await page.locator('#error').isVisible(),false);
});

test('primary review works locally with dated per-site execution and rollback counts',async t=>{
 const page=await open(t);const response=await page.goto(url);assert.equal(response.status(),200,'Tool page exists');
 assert.equal(await page.title(),'Microsoft 365 Change Window Review | System8');assert.equal(await page.locator('#start').inputValue(),'');
 assert.equal(await page.locator('.site-zone').inputValue(),'Australia/Perth');assert.equal(await page.locator('.work-start').inputValue(),'09:00');assert.equal(await page.locator('.work-end').inputValue(),'17:00');assert.equal(await page.locator('.weekdays input:checked').count(),5);
 await fill(page);await page.getByRole('button',{name:'Review local impact',exact:true}).click();
 assert.equal(await page.locator('.site-result').count(),1);assert.match(await page.locator('#summary').textContent(),/1 site/);
 assert.match(await page.locator('.execution-count').textContent(),/30 of 60/);assert.match(await page.locator('.rollback-count').textContent(),/30 of 30/);
 for(const text of ['2026-11-26 08:30','2026-11-26 09:30','2026-11-26 10:00','UTC+08:00','execution overlaps working time','rollback overlaps working time'])assert.ok((await page.locator('#results').textContent()).includes(text));
 assert.match(await page.locator('main').textContent(),/No sign-in/);assert.match(await page.locator('main').textContent(),/No holidays/);
});
