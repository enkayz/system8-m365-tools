import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const moduleURL=new URL('../public/tools/change-window-review/core.mjs',import.meta.url);
const site=(overrides={})=>({name:'Illustrative Perth site',timeZone:'Australia/Perth',weekdays:[1,2,3,4,5],workStart:'09:00',workEnd:'17:00',...overrides});
const plan=(overrides={})=>({start:'2026-11-26T00:30Z',executionMinutes:60,rollbackMinutes:30,notes:'',sites:[site()],...overrides});
async function core(){assert.ok(existsSync(moduleURL),'Change window core exists');return import(moduleURL);}
test('zero rollback remains distinguishable from a reviewed nonzero allowance',async()=>{
 const {review}=await core();const r=review(plan({start:'2026-11-26T09:00Z',executionMinutes:1,rollbackMinutes:0,sites:[site({timeZone:'UTC',workStart:'09:01',workEnd:'10:00'})]}));
 assert.equal(r.rows[0].executionOverlapMinutes,0);assert.equal(r.rows[0].rollbackOverlapMinutes,0);
 assert.ok(r.rows[0].flags.includes('rollback allowance is zero'));assert.equal(r.rows[0].executionEnd.offset,'UTC+00:00');
});
test('exports retain all schedules and phase boundaries with formula-protected review CSV',async()=>{
 const {review,reviewCSV}=await core();assert.equal(typeof reviewCSV,'function');
 const input=plan({notes:'  =HYPERLINK("example")\ninternal note',sites:[site({name:'=1+1'}),site({name:' +SUM(1,2)',timeZone:'Asia/Kathmandu'}),site({name:'<img src=x onerror=alert(1)>',timeZone:'America/New_York'})]});
 const r=review(input);assert.equal(r.version,'1.0.0');assert.equal(r.input.start,input.start);assert.match(r.model,/elapsed minute/);assert.match(r.limits,/holidays/);
 input.sites[0].weekdays.push(7);assert.equal(r.input.sites[0].weekdays.length,5);
 const text=reviewCSV(r);assert.ok(text.startsWith('"Site","Time zone"'));assert.match(text,/"'=1\+1"/);assert.match(text,/"' \+SUM\(1,2\)"/);assert.ok(text.includes("'  =HYPERLINK"));assert.ok(text.includes('America/New_York'));assert.ok(text.includes('UTC+05:45'));assert.ok(text.includes('2026-11-26T02:00Z'));assert.ok(text.endsWith('\r\n'));assert.equal(JSON.parse(JSON.stringify(r)).rows.length,3);
});

test('review counts execution and consecutive rollback collisions independently',async()=>{
 const {review}=await core();const r=review(plan());
 assert.equal(r.rows.length,1);assert.equal(r.rows[0].executionOverlapMinutes,30);assert.equal(r.rows[0].rollbackOverlapMinutes,30);
 assert.deepEqual(r.rows[0].flags,['execution overlaps working time','rollback overlaps working time']);
 assert.equal(r.rows[0].start.local,'2026-11-26 08:30');assert.equal(r.rows[0].executionEnd.local,'2026-11-26 09:30');assert.equal(r.rows[0].rollbackEnd.local,'2026-11-26 10:00');assert.equal(r.rows[0].start.offset,'UTC+08:00');
});

test('elapsed-minute regressions cover DST, exclusive boundaries, custom workweeks and date rollover',async()=>{
 const {review}=await core();
 const cases=[
  ['spring skipped hour','2026-03-08T06:00Z',120,30,site({timeZone:'America/New_York',weekdays:[7],workStart:'01:30',workEnd:'03:30'}),60,0,'2026-03-08 01:00','2026-03-08 04:00','UTC-05:00','UTC-04:00'],
  ['fall repeated hour','2026-11-01T05:00Z',60,60,site({timeZone:'America/New_York',weekdays:[7],workStart:'01:00',workEnd:'02:00'}),60,60,'2026-11-01 01:00','2026-11-01 01:00','UTC-04:00','UTC-05:00'],
  ['rollback only','2026-11-26T00:00Z',60,60,site(),0,60,'2026-11-26 08:00','2026-11-26 09:00','UTC+08:00','UTC+08:00'],
  ['end excluded','2026-11-26T09:00Z',60,1,site({timeZone:'UTC',workStart:'09:00',workEnd:'10:00'}),60,0,'2026-11-26 09:00','2026-11-26 10:00','UTC+00:00','UTC+00:00'],
  ['custom off weekday','2026-11-26T01:00Z',60,30,site({weekdays:[5,6,7]}),0,0,'2026-11-26 09:00','2026-11-26 10:00','UTC+08:00','UTC+08:00'],
  ['leap date rollover','2024-02-28T23:30Z',60,30,site({timeZone:'UTC',weekdays:[4],workStart:'00:00',workEnd:'01:00'}),30,30,'2024-02-28 23:30','2024-02-29 00:30','UTC+00:00','UTC+00:00'],
  ['fractional offset','2026-11-26T03:15Z',1,0,site({timeZone:'Asia/Kathmandu'}),1,0,'2026-11-26 09:00','2026-11-26 09:01','UTC+05:45','UTC+05:45'],
  ['international date line','2026-11-26T10:30Z',60,0,site({timeZone:'Pacific/Kiritimati',weekdays:[5],workStart:'00:00',workEnd:'01:00'}),30,0,'2026-11-27 00:30','2026-11-27 01:30','UTC+14:00','UTC+14:00'],
 ];
 for(const [label,start,executionMinutes,rollbackMinutes,s,execution,rollback,localStart,localEnd,offsetStart,offsetEnd] of cases){const r=review(plan({start,executionMinutes,rollbackMinutes,sites:[s]})).rows[0];assert.deepEqual([r.executionOverlapMinutes,r.rollbackOverlapMinutes,r.start.local,r.executionEnd.local,r.start.offset,r.executionEnd.offset],[execution,rollback,localStart,localEnd,offsetStart,offsetEnd],label);}
});

test('invalid or excessive plans fail closed with generic bounded errors',async()=>{
 const {review}=await core();
 const bad=[null,{},plan({start:"2026-02-29T00:00Z"}),plan({start:"2026-11-26T00:00:00Z"}),plan({start:"2026-11-26T00:00+00:00"}),plan({start:" 2026-11-26T00:00Z"}),plan({start:"1999-12-31T23:00Z"}),plan({executionMinutes:0}),plan({executionMinutes:1.5}),plan({executionMinutes:"60"}),plan({rollbackMinutes:-1}),plan({rollbackMinutes:0.5}),plan({executionMinutes:1440,rollbackMinutes:1}),plan({sites:[]}),plan({sites:Array.from({length:21},()=>site())}),plan({notes:"x".repeat(1001)}),...[
  {name:""},{name:"x".repeat(81)},{name:"bad\u0000name"},{timeZone:"<img src=x>"},{timeZone:"Mars/Olympus"},{timeZone:"+08:00"},{timeZone:"CST"},{weekdays:[]},{weekdays:[0]},{weekdays:[1,1]},{weekdays:["1"]},{workStart:"17:00",workEnd:"09:00"},{workStart:"09:00",workEnd:"09:00"},{workEnd:"24:00"},{workStart:"9:00"}
 ].map(s=>plan({sites:[site(s)]}))];
 for(const input of bad)assert.throws(()=>review(input),e=>e instanceof Error && !e.message.includes("<img") && /Enter|Choose|Use|Add/.test(e.message));
 const r=review({...plan({rollbackMinutes:0}),secret:"excluded",sites:[{...site(),secret:"excluded"}]});assert.equal(JSON.stringify(r).includes("excluded"),false);
 assert.equal(review(plan({executionMinutes:1440,rollbackMinutes:0,sites:Array.from({length:20},()=>site())})).rows.length,20);
});
