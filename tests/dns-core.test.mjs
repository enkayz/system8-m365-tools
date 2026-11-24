import test from 'node:test';
import assert from 'node:assert/strict';
const path='../public/tools/mail-dns-cutover/core.mjs';
test('unknown lowering retains deadline only; shortfalls counted across RRsets',async()=>{
 const {calculate}=await import(path);
 const r=calculate('2026-11-23T10:00:00Z',[{...row,actualLowered:''},{...row,name:'autodiscover.example.test',type:'CNAME',actualLowered:'2026-11-23T09:30:00Z'}]);
 assert.equal(r.unverifiedCount,1); assert.equal(r.shortfallCount,1);
 assert.equal(r.rows[0].status,'Unverified'); assert.equal(r.rows[0].oldCacheExpiry,null); assert.equal(r.rows[0].modeledWindowEnd,null);
 assert.equal(r.rows[1].shortfallSeconds,1800); assert.equal(r.rows[1].modeledWindowEnd,'2026-11-23T10:30:00.000Z');
});
test('strict UTC or offset calendar timestamps reject ambiguous and normalized dates',async()=>{
 const {calculate}=await import(path);
 for(const date of ['2026-02-30T10:00:00Z','2026-11-23T10:00:00','2026-11-23','2026-11-23T24:00:00Z','2026-11-23T10:00:00+24:00','2026-11-23T10:00:60Z','0000-01-01T00:00:00Z','2026-11-23T10:00:00Zjunk']) assert.throws(()=>calculate(date,[row]),/cutover/i,date);
 assert.equal(calculate('2026-11-23T18:00:00+08:00',[row]).cutover,'2026-11-23T10:00:00.000Z');
 assert.doesNotThrow(()=>calculate('2028-02-29T10:00:00Z',[{...row,actualLowered:''}]));
 assert.throws(()=>calculate('2026-11-23T10:00:00Z',[{...row,actualLowered:'2026-02-30T09:00:00Z'}]),/Row 1/);
 assert.throws(()=>calculate('2026-11-23T10:00:00Z',[{...row,actualLowered:'2026-11-23T10:00:01Z'}]),/after cutover/);
});
test('RRset validation bounds rows, DNS labels, duplicate identities, types and TTLs',async()=>{
 const {calculate}=await import(path);const c='2026-11-23T10:00:00Z';
 for(const name of ['','-x.test','x-.test','a..test','é.test','<img src=x>','a'.repeat(64)+'.test','a.'.repeat(128)]) assert.throws(()=>calculate(c,[{...row,name}]),/Row 1/);
 for(const oldTTLseconds of ['', '-1','1.1','1e3',' 3600','2147483648','NaN'])assert.throws(()=>calculate(c,[{...row,oldTTLseconds}]),/Row 1/);
 for(const newTTLseconds of ['', '-1','3601','0.1'])assert.throws(()=>calculate(c,[{...row,newTTLseconds}]),/Row 1/);
 assert.throws(()=>calculate(c,[{...row,type:'A'}]),/Row 1/);
 assert.throws(()=>calculate(c,[row,{...row,name:'EXAMPLE.TEST.'}]),/duplicate/i);
 assert.throws(()=>calculate(c,[]),/1.*100/);assert.throws(()=>calculate(c,Array(101).fill(row)),/1.*100/);
 assert.doesNotThrow(()=>calculate(c,[{...row,oldTTLseconds:'0',newTTLseconds:'0'}]));
 const r=calculate(c,[{...row,name:'EXAMPLE.TEST.',secret:'discard'}]);assert.equal(r.rows[0].name,'example.test');assert.equal(r.rows[0].secret,undefined);assert.equal(r.rows[0].oldTTLseconds,3600);
});
test('handoff exports include every row, assumptions and protected quoted CSV cells',async()=>{
 const {calculate,toCSV,toJSON,csvCell}=await import(path);
 const r=calculate('2026-11-23T10:00:00Z',[row,{...row,name:'selector1._domainkey.example.test',type:'CNAME',actualLowered:''}]);
 const j=JSON.parse(toJSON(r));assert.equal(j.rows.length,2);assert.equal(j.version,'1.0.0');assert.match(j.assumptions.join(' '),/ALL authoritative/);assert.match(j.assumptions.join(' '),/serve-stale/);
 const csv=toCSV(r);assert.match(csv,/selector1\._domainkey/);assert.match(csv,/Unverified/);assert.match(csv,/ALL authoritative/);assert.equal(csv.split('\r\n').length,3);
 for(const value of ['=1+1','+SUM(A1)','-1','@x','\t=1','\n=1'])assert.ok(csvCell(value).startsWith('"\''));
 assert.equal(csvCell('a,"b"'),'"a,""b"""');
});
test('boundary regression: 100 RRsets, zero TTLs, fractional timestamps and century leap rules',async()=>{
 const {calculate}=await import(path);const c='2026-11-23T10:00:00Z';
 const result=calculate(c,Array.from({length:100},(_,i)=>({...row,name:`rr${i}.example.test`,actualLowered:''})));assert.equal(result.rows.length,100);assert.equal(result.unverifiedCount,100);
 const fraction=calculate(c,[{...row,oldTTLseconds:'0',newTTLseconds:'0',actualLowered:'2026-11-23T10:00:00.000Z'}]);assert.equal(fraction.rows[0].modeledWindowEnd,'2026-11-23T10:00:00.000Z');
 assert.throws(()=>calculate('2100-02-29T10:00:00Z',[{...row,actualLowered:''}]),/calendar/);
 assert.doesNotThrow(()=>calculate('2000-02-29T10:00:00Z',[{...row,actualLowered:''}]));
 assert.equal(calculate(c,[{...row,actualLowered:'2026-11-23T09:00:00.001Z'}]).rows[0].shortfallSeconds,0.001);
 assert.throws(()=>calculate(c,[{...row,name:'x.test.',type:'TXT'},{...row,name:'X.TEST',type:'TXT'}]),/duplicate/);
 assert.doesNotThrow(()=>calculate(c,[row,{...row,type:'TXT'}]));
 for(const invalid of [null,{},'abc',Array(1)])assert.throws(()=>calculate(c,invalid));
});
const row={name:'example.test',type:'MX',oldTTLseconds:'3600',newTTLseconds:'300',actualLowered:'2026-11-23T09:00:00Z'};
test('known lowering models a common cutover and old-cache window',async()=>{
 const {calculate}=await import(path); const r=calculate('2026-11-23T10:00:00Z',[row]);
 assert.equal(r.rows[0].plannedLowerBy,'2026-11-23T09:00:00.000Z');
 assert.equal(r.rows[0].oldCacheExpiry,'2026-11-23T10:00:00.000Z');
 assert.equal(r.rows[0].modeledWindowEnd,'2026-11-23T10:05:00.000Z');
 assert.equal(r.rows[0].shortfallSeconds,0);
});
