import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,access} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/hermes/projects/system8-m365-dashboard/node_modules/playwright');
const executablePath=process.env.PLAYWRIGHT_EXECUTABLE||'/home/hermes/projects/system8-m365-dashboard/test-results/playwright-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const evidenceId=process.env.DNS_EVIDENCE_ID||Date.now().toString();
const url=process.env.DNS_TOOL_URL||'http://127.0.0.1:3363/tools/mail-dns-cutover/';
async function open(t,width=1440){const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width,height:1000},acceptDownloads:true});return page;}
async function fillRow(page,index,{name='example.test',type='MX',old='3600',next='300',actual=''}={}){const row=page.locator('#rows fieldset').nth(index);await row.getByLabel('DNS name').fill(name);await row.getByLabel('Record type').selectOption(type);await row.getByLabel('Old TTL (seconds)').fill(old);await row.getByLabel('New TTL (seconds)').fill(next);await row.getByLabel('Actual lowering time (optional)').fill(actual);}
test('archive navigation stays readable against navy header',async t=>{
 const page=await open(t);await page.goto(url);
 const color=await page.locator('header a').evaluate(e=>getComputedStyle(e).color);
 assert.equal(color,'rgb(255, 255, 255)');
 assert.equal(await page.locator('header a').getAttribute('href'),'/tools/');
});
test('field blur exposes accessible validation before calculation; edit clears the marker',async t=>{
 const page=await open(t);await page.goto(url);const name=page.locator('[name=name]');await name.fill('<script>alert(1)</script>');await page.locator('[name=oldTTLseconds]').focus();
 assert.equal(await name.getAttribute('aria-invalid'),'true');assert.match(await page.locator('#error').textContent(),/DNS name/);assert.equal(await page.locator('#error script').count(),0);
 await name.fill('example.test');assert.equal(await name.getAttribute('aria-invalid'),null);assert.equal(await page.locator('#error').isVisible(),false);
 await page.locator('#cutover').fill('2026-02-30T10:00:00Z');await name.focus();assert.equal(await page.locator('#cutover').getAttribute('aria-invalid'),'true');
 await page.getByRole('button',{name:'Clear worksheet',exact:true}).click();assert.equal(await page.locator('#cutover').getAttribute('aria-invalid'),null);
});
test('responsive keyboard workflow and evidence at 320, 390 and 1440 pixels',async t=>{
 for(const width of [320,390,1440]){
  const page=await open(t,width);await page.goto(url);await page.keyboard.press('Tab');assert.match(await page.locator(':focus').textContent(),/Skip to worksheet/);await page.keyboard.press('Enter');
  await page.locator('#cutover').fill('2026-11-23T10:00:00Z');await fillRow(page,0,{actual:'2026-11-23T09:00:00Z'});
  await page.getByRole('button',{name:'Add RRset',exact:true}).click();assert.equal(await page.locator('[name=name]').nth(1).evaluate(e=>e===document.activeElement),true);await fillRow(page,1,{name:'selector1._domainkey.example.test',type:'CNAME'});
  await page.getByRole('button',{name:'Calculate handoff',exact:true}).focus();await page.keyboard.press('Enter');assert.match(await page.locator('#summary').textContent(),/1 unverified/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.match(await page.locator('#table-help').textContent(),/Scroll horizontally/);
  if(width===1440){const bottoms=await page.locator('#rows fieldset').first().locator('input,select').evaluateAll(controls=>controls.map(c=>c.getBoundingClientRect().bottom));assert.ok(Math.max(...bottoms)-Math.min(...bottoms)<=1);}
  await page.locator('#review').focus();await page.keyboard.press('ArrowRight');
  await page.evaluate(()=>{document.querySelector('#review').scrollLeft=0;window.scrollTo(0,0);});
  const screenshot=`receipts/2026-11-23/build-ui-${evidenceId}-${width}.png`;
  assert.equal(await access(screenshot).then(()=>true,()=>false),false,'Refuse to overwrite existing screenshot');
  await page.screenshot({path:screenshot,fullPage:true});
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();assert.match(await readFile(await (await dl).path(),'utf8'),/selector1\._domainkey/);
  await page.getByRole('button',{name:'Remove RRset 2',exact:true}).click();assert.equal(await page.locator('#review').isVisible(),false);assert.equal(await page.locator('#rows fieldset').count(),1);
  await page.locator('#cutover').fill('2026-02-30T10:00:00Z');await page.getByRole('button',{name:'Calculate handoff',exact:true}).click();assert.equal(await page.locator('#error').evaluate(e=>e===document.activeElement),true);assert.match(await page.locator('#error').textContent(),/invalid calendar/);
 }
});
test('UI bounds rows and inputs; select and cutover edits invalidate; refresh retains nothing',async t=>{
 const page=await open(t);await page.goto(url);
 assert.equal(await page.locator('[name=name]').getAttribute('maxlength'),'254');assert.equal(await page.locator('#cutover').getAttribute('maxlength'),'35');
 await page.locator('#cutover').fill('2026-11-23T10:00:00Z');await fillRow(page,0);await page.getByRole('button',{name:'Calculate handoff',exact:true}).click();await page.locator('[name=type]').selectOption('TXT');assert.equal(await page.locator('#review').isVisible(),false);
 await page.getByRole('button',{name:'Calculate handoff',exact:true}).click();await page.locator('#cutover').fill('2026-11-23T11:00:00Z');assert.equal(await page.getByRole('button',{name:'Download CSV'}).isEnabled(),false);
 await page.evaluate(()=>{for(let i=0;i<105;i++)document.querySelector('#add').click();});assert.equal(await page.locator('#rows fieldset').count(),100);assert.equal(await page.locator('#add').isEnabled(),false);
 await page.reload();assert.equal(await page.locator('#cutover').inputValue(),'');assert.equal(await page.locator('#rows fieldset').count(),1);
});
test('browser multi-RRset handoff calculates unknowns and shortfalls, downloads all rows, invalidates and clears',async t=>{
 const page=await open(t);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(url);assert.equal(await page.title(),'Mail DNS Cutover Worksheet | System8');
 assert.equal(await page.locator('#rows fieldset').count(),1);assert.equal(await page.locator('[name=name]').inputValue(),'');
 await page.getByLabel('Planned cutover time').fill('2026-11-23T10:00:00Z');await fillRow(page,0);
 await page.getByRole('button',{name:'Add RRset',exact:true}).click();await fillRow(page,1,{name:'autodiscover.example.test',type:'CNAME',actual:'2026-11-23T09:30:00Z'});
 await page.getByRole('button',{name:'Calculate handoff',exact:true}).click();
 assert.match(await page.locator('#summary').textContent(),/1 unverified.*1.*shortfall/);
 assert.equal(await page.locator('#review tbody tr').count(),2);assert.match(await page.locator('#review').textContent(),/3600 → 300/);assert.match(await page.locator('#review').textContent(),/2026-11-23T10:30:00.000Z/);
 for(const ext of ['JSON','CSV']){const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Download '+ext,exact:true}).click();const download=await waiting;const text=await readFile(await download.path(),'utf8');await writeFile(`receipts/2026-11-23/build-export-${evidenceId}.${ext.toLowerCase()}`,text,{flag:'wx'});if(ext==='JSON'){const data=JSON.parse(text);assert.equal(data.rows.length,2);assert.equal(data.rows[0].modeledWindowEnd,null);}else{assert.match(text,/Unverified/);assert.match(text,/autodiscover.example.test/);assert.match(text,/ALL authoritative/);}}
 await page.locator('[name=oldTTLseconds]').first().fill('7200');assert.equal(await page.locator('#review').isVisible(),false);assert.equal(await page.getByRole('button',{name:'Download JSON'}).isEnabled(),false);
 await page.getByRole('button',{name:'Clear worksheet',exact:true}).click();assert.equal(await page.locator('#cutover').inputValue(),'');assert.equal(await page.locator('#rows fieldset').count(),1);
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.startsWith(new URL(url).origin)));assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
});
