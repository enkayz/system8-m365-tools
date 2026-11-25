import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/hermes/projects/system8-m365-dashboard/node_modules/playwright');
const executablePath=process.env.PLAYWRIGHT_EXECUTABLE||'/home/hermes/projects/system8-m365-dashboard/test-results/playwright-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const url=process.env.ALIAS_TOOL_URL||'http://127.0.0.1:3364/tools/exchange-alias-claims/';
const evidence=process.env.ALIAS_EVIDENCE_DIR;
assert.ok(evidence && isAbsolute(evidence),'Set ALIAS_EVIDENCE_DIR to a fresh absolute build-* directory');
await mkdir(evidence,{recursive:true});
const A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',C='cccccccc-cccc-cccc-cccc-cccccccccccc';
const csv=(rows)=>'RecipientId,Address\n'+rows.join('\n');
async function open(t,width=1440){const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});t.after(()=>browser.close());return browser.newPage({viewport:{width,height:1000},acceptDownloads:true});}
async function fill(page,current=csv([A+',shared@example.test',B+',shared@example.test']),requested=csv([A+',shared@example.test',C+',shared@example.test',C+',shared@example.test',A+',absent@example.test'])){await page.locator('#current').fill(current);await page.locator('#requested').fill(requested);await page.locator('#identity').check();}
test('file replacement is strict and stale file completions cannot revive cleared or edited evidence',async t=>{
 const page=await open(t);await page.goto(url);await fill(page);await page.getByRole('button',{name:'Review claims',exact:true}).click();
 const upload=async(id,buffer)=>page.locator('#'+id+'-file').setInputFiles({name:'illustrative.csv',mimeType:'text/csv',buffer});
 await upload('current',Buffer.from(csv([B+',file@example.test'])));await page.waitForFunction(()=>document.querySelector('#current').value.includes('file@example.test'));
 assert.equal(await page.locator('#json').isDisabled(),true);
 await upload('current',Buffer.from([0xff]));await page.waitForFunction(()=>document.querySelector('#current-state').textContent.includes('UTF-8'));
 assert.equal(await page.locator('#current').inputValue(),'');assert.equal(await page.locator('#current-file').inputValue(),'');
 await upload('current',Buffer.alloc(1048577,65));await page.waitForFunction(()=>document.querySelector('#current-state').textContent.includes('1 MiB'));assert.equal(await page.locator('#current').inputValue(),'');
 await upload('current',Buffer.from(csv([A+',SMTP:bad@example.test'])));await page.waitForFunction(()=>document.querySelector('#current-state').textContent.includes('bare ASCII'));assert.equal(await page.locator('#current').inputValue(),'');
 // Delay only native local file reading, never synthesize comparison results.
 await page.evaluate(()=>{const original=File.prototype.arrayBuffer;window.reads=[];File.prototype.arrayBuffer=function(){return new Promise((resolve,reject)=>window.reads.push(()=>original.call(this).then(resolve,reject)));};});
 await upload('current',Buffer.from(csv([A+',stale@example.test'])));assert.equal(await page.locator('#current').inputValue(),'');
 await page.getByRole('button',{name:'Review claims',exact:true}).click();assert.match(await page.locator('#error').textContent(),/reading/i);
 await page.getByRole('button',{name:'Clear inputs and review',exact:true}).click();await page.evaluate(()=>window.reads.shift()());await page.waitForTimeout(30);assert.equal(await page.locator('#current').inputValue(),'');
 await upload('current',Buffer.from(csv([A+',stale@example.test'])));await page.locator('#current').fill(csv([B+',typed@example.test']));await page.evaluate(()=>window.reads.shift()());await page.waitForTimeout(30);assert.match(await page.locator('#current').inputValue(),/typed@example.test/);
 await upload('requested',Buffer.from(csv([A+',old@example.test'])));await upload('requested',Buffer.from(csv([B+',new@example.test'])));await page.evaluate(()=>window.reads.pop()());await page.waitForFunction(()=>document.querySelector('#requested').value.includes('new@example.test'));await page.evaluate(()=>window.reads.pop()());await page.waitForTimeout(30);assert.match(await page.locator('#requested').inputValue(),/new@example.test/);
 await page.getByRole('button',{name:'Clear inputs and review',exact:true}).click();assert.equal(await page.locator('#requested-file').inputValue(),'');
});
test('bounded filtered review retains every export row and works by keyboard on desktop and mobile',async t=>{
 for(const width of [320,390,1440]){
  const page=await open(t,width);await page.goto(url);await page.keyboard.press('Tab');assert.match(await page.locator(':focus').textContent(),/Skip to claim review/);await page.keyboard.press('Enter');
  const plan=csv(Array.from({length:125},(_,i)=>A+',=claim'+i+'@example.test'));
  await fill(page,csv([B+',=claim0@example.test']),plan);await page.getByRole('button',{name:'Review claims',exact:true}).focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('tbody tr').count(),100);assert.match(await page.locator('#visible-count').textContent(),/100 of 125/);
  await page.locator('#filter').selectOption('current-other-owner conflict');assert.equal(await page.locator('tbody tr').count(),1);
  await page.locator('#search').fill('notpresent');assert.equal(await page.locator('tbody tr').count(),0);assert.match(await page.locator('#visible-count').textContent(),/0 of 0/);
  const wait=page.waitForEvent('download');await page.locator('#json').click();assert.equal(JSON.parse(await readFile(await (await wait).path(),'utf8')).rows.length,125);
  await page.locator('#filter').selectOption('all');await page.locator('#search').fill('claim124');assert.equal(await page.locator('tbody tr').count(),1);
  await page.locator('#search').fill('');await page.locator('#review').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#review').evaluate(e=>e===document.activeElement),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('header a').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
  await page.locator('#filter').selectOption('current-other-owner conflict');await page.waitForTimeout(250);await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('#review').scrollTo({left:0,top:0,behavior:'instant'});});assert.equal(await page.locator('#review').evaluate(e=>e.scrollLeft),0);
  await page.screenshot({path:join(evidence,'build-ui-'+width+'.png'),fullPage:true});
 }
});
test('field validation identifies the side without reflecting hostile content; editing clears markers',async t=>{
 const page=await open(t);await page.goto(url);
 await page.locator('#requested').fill(csv([A+',<img src=x onerror=alert(1)>@example.test']));await page.locator('#identity').focus();
 assert.equal(await page.locator('#requested').getAttribute('aria-invalid'),'true');assert.match(await page.locator('#requested-state').textContent(),/bare ASCII/);assert.equal(await page.locator('#requested-state img').count(),0);
 await page.locator('#requested').fill(csv([A+',normal@example.test']));assert.equal(await page.locator('#requested').getAttribute('aria-invalid'),null);
 await page.locator('#identity').check();await page.getByRole('button',{name:'Review claims',exact:true}).click();assert.match(await page.locator('#error').textContent(),/Current recipient CSV/);assert.equal(await page.locator('#error').evaluate(e=>e===document.activeElement),true);
 await fill(page);await page.getByRole('button',{name:'Review claims',exact:true}).click();await page.locator('#requested').fill(csv([A+',SMTP:bad@example.test']));assert.equal(await page.locator('#json').isDisabled(),true);await page.getByRole('button',{name:'Review claims',exact:true}).click();assert.match(await page.locator('#error').textContent(),/Requested claim CSV/);
 const crowded=csv(Array.from({length:225},(_,i)=>i.toString(16).padStart(8,'0')+'-aaaa-aaaa-aaaa-aaaaaaaaaaaa,a@example.test'));
 await fill(page,crowded,crowded);await page.getByRole('button',{name:'Review claims',exact:true}).click();assert.match(await page.locator('#error').textContent(),/50000/);assert.equal(await page.locator('#json').isDisabled(),true);assert.equal(await page.locator('tbody tr').count(),0);
 await page.reload();assert.equal(await page.locator('#current').inputValue(),'');assert.equal(await page.locator('#requested').inputValue(),'');assert.equal(await page.locator('#identity').isChecked(),false);
});
test('oversized pasted evidence is rejected rather than silently truncated by an input limit',async t=>{
 const page=await open(t);await page.goto(url);
 assert.equal(await page.locator('#current').getAttribute('maxlength'),null,'Native truncation could turn incomplete pasted evidence into a valid subset');
 assert.equal(await page.locator('#requested').getAttribute('maxlength'),null);
 const oversized=csv([A+',a@example.test'])+'\n'+('x'.repeat(1048576));
 await fill(page,oversized,csv([A+',a@example.test']));await page.getByRole('button',{name:'Review claims',exact:true}).click();assert.match(await page.locator('#error').textContent(),/1 MiB/);assert.equal(await page.locator('#csv').isDisabled(),true);
});
test('local review exposes all independent flags, duplicates and explicit all-row exports',async t=>{
 const page=await open(t);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await page.goto(url);
 assert.equal(await page.title(),'Exchange Alias Claim Review | System8');
 assert.equal(await page.locator('#current').inputValue(),'');assert.equal(await page.locator('#json').isDisabled(),true);
 await fill(page);await page.getByRole('button',{name:'Review claims',exact:true}).click();
 assert.equal(await page.locator('tbody tr').count(),3);const first=await page.locator('tbody tr').first().textContent();
 for(const flag of ['current-other-owner conflict','multiple-request-owner conflict','current-same-owner'])assert.ok(first.includes(flag));
 assert.match(await page.locator('#summary').textContent(),/1 duplicate requested/);
 for(const ext of ['json','csv']){const wait=page.waitForEvent('download');await page.locator('#'+ext).click();const d=await wait;const content=await readFile(await d.path(),'utf8');await writeFile(join(evidence,'build-export.'+ext),content,{flag:'wx'});if(ext==='json')assert.equal(JSON.parse(content).rows.length,3);else assert.match(content,/absent@example.test/);}
 await page.locator('#current').fill(csv([A+',other@example.test']));assert.equal(await page.locator('#json').isDisabled(),true);assert.equal(await page.locator('#review').isVisible(),false);
 await page.getByRole('button',{name:'Review claims',exact:true}).click();await page.locator('#identity').uncheck();assert.equal(await page.locator('#csv').isDisabled(),true);
 await page.getByRole('button',{name:'Clear inputs and review',exact:true}).click();assert.equal(await page.locator('#current').inputValue(),'');assert.equal(await page.locator('#requested').inputValue(),'');
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.startsWith(new URL(url).origin)));assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
});
