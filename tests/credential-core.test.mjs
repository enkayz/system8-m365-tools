import test from 'node:test';
import assert from 'node:assert/strict';
let core={};try{core=await import('../public/tools/credential-coverage/core.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const header='AppId,Kind,CredentialId,StartUtc,EndUtc';
const row=(id=B,start='2026-11-01T00:00Z',end='2026-12-01T00:00Z',kind='secret',app=A)=>[app,kind,id,start,end].join(',');
const csv=(...rows)=>[header,...rows].join('\n');
const start='2026-11-10T00:00Z',end='2026-11-20T00:00Z';
test('CSV rejects ambiguous schemas, malformed fields and unsupported records without echo',()=>{
 const invalid=['',header,header+'\n',header+',SecretValue\n'+row()+',DO-NOT-ECHO',header.replace('Kind','Kind,Kind')+'\n'+row(),csv(row()).replace('AppId','appId'),csv(row()).replace(A,' '+A),csv(row()).replace(B,'{'+B+'}'),csv(row()).replace('secret','password'),csv(row()).replace('2026-11-01T00:00Z','2026-11-01'),csv(row()).replace('2026-11-01T00:00Z','2026-11-01T00:00+00:00'),csv(row()).replace('2026-11-01T00:00Z','2026-11-01T00:00:00Z'),csv(row()).replace('2026-11-01T00:00Z','2026-02-30T00:00Z'),csv(row()).replace('2026-11-01T00:00Z','1999-11-01T00:00Z'),csv(row(B,end,start)),csv(row(B,start,start)),csv(row()).replace(B,'=DO-NOT-ECHO'),csv(row())+',extra',csv(row()).replace(B,'"bad"oops')];
 for(const input of invalid)assert.throws(()=>core.parseMetadata(input),e=>e instanceof Error&&!e.message.includes('DO-NOT-ECHO'));
 assert.deepEqual(core.parseMetadata('\ufeff'+header+'\r\n"'+A+'",secret,"'+B+'",2026-11-01T00:00Z,2026-12-01T00:00Z\r\n'),core.parseMetadata(csv(row())));
});
test('duplicate IDs within an application and kind reject rather than inflate overlap',()=>{
 assert.throws(()=>core.parseMetadata(csv(row(),row(B.toUpperCase()))),/duplicate/i);
 assert.equal(core.parseMetadata(csv(row(),row(B,undefined,undefined,'certificate'),row(B,undefined,undefined,'secret',C))).length,3);
});
test('input bounds reject more than 1000 rows or 1 MiB UTF-8 before review',()=>{
 const rows=Array.from({length:1000},(_,i)=>row(i.toString(16).padStart(8,'0')+'-0000-0000-0000-000000000000'));
 assert.equal(core.parseMetadata(csv(...rows)).length,1000);
 assert.throws(()=>core.parseMetadata(csv(...rows,row(C))),/1000/);
 assert.throws(()=>core.parseMetadata('é'.repeat(524289)),/1 MiB/);
});
test('review validates a positive explicit UTC horizon of at most 366 days',()=>{
 assert.equal(typeof core.reviewCoverage,'function','coverage review exists');
 for(const [s,e] of [['',end],[start,'2026-11-20'],[start,start],[end,start],['2026-01-01T00:00Z','2027-01-03T00:00Z'],['2026-02-29T00:00Z',end],['2026-11-10T00:00+00:00',end]])assert.throws(()=>core.reviewCoverage(csv(row()),s,e));
 const r=core.reviewCoverage(csv(row()),'2026-01-01T00:00Z','2027-01-02T00:00Z');assert.equal(r.horizon.minutes,527040);
 assert.throws(()=>core.reviewCoverage(header,start,end),/at least one/);
});
test('coverage partitions the clipped horizon by distinct active IDs per application and kind',()=>{
 const D='dddddddd-dddd-dddd-dddd-dddddddddddd',E='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',F='ffffffff-ffff-ffff-ffff-ffffffffffff';
 const t=h=>'2026-11-10T'+String(h).padStart(2,'0')+':00Z';
 const data=csv(row(B,'2026-11-09T23:00Z',t(2)),row(C,t(1),t(4)),row(D,t(4),t(5)),row(E,t(7),t(8)),row(F,'2026-11-01T00:00Z',t(0)),row(A,t(10),t(11)),row(B,t(0),t(10),'certificate'),row(B,t(10),t(11),'secret',B));
 const r=core.reviewCoverage(data,t(0),t(10));assert.ok(Array.isArray(r.groups),'grouped coverage exists');assert.equal(r.groups.length,3);
 const g=r.groups.find(g=>g.appId===A&&g.kind==='secret');
 assert.deepEqual(g.windows.map(w=>[w.type,w.startUtc,w.endUtc,w.minutes,w.credentialIds.length]),[['single',t(0),t(1),60,1],['overlap',t(1),t(2),60,2],['single',t(2),t(4),120,1],['single',t(4),t(5),60,1],['gap',t(5),t(7),120,0],['single',t(7),t(8),60,1],['gap',t(8),t(10),120,0]]);
 assert.deepEqual(g.windows[1].credentialIds,[B,C]);assert.equal(g.gapMinutes,240);assert.equal(g.overlapMinutes,60);assert.equal(g.coveredMinutes,360);
 assert.equal(g.evidence.filter(e=>e.relation==='outside').length,2);assert.equal(g.evidence.find(e=>e.credentialId===F).clippedStartUtc,null);assert.equal(g.evidence.find(e=>e.credentialId===B).clippedStartUtc,t(0));assert.equal(g.evidence.find(e=>e.credentialId===B).startUtc,'2026-11-09T23:00Z');
 assert.equal(r.groups.find(g=>g.kind==='certificate').gapMinutes,0);assert.equal(r.groups.find(g=>g.appId===B).gapMinutes,600);
 for(const group of r.groups)assert.equal(group.windows.reduce((n,w)=>n+w.minutes,0),600);
 assert.deepEqual(core.reviewCoverage(csv(...data.split('\n').slice(1).reverse()),t(0),t(10)).groups,r.groups);
});
test('explicit export serializers retain all groups, windows and evidence with spreadsheet protection',()=>{
 assert.equal(typeof core.toJSON,'function','JSON export exists');assert.equal(typeof core.toCSV,'function','CSV export exists');
 const r=core.reviewCoverage(csv(row(),row(C,'2026-11-11T00:00Z','2026-11-15T00:00Z'),row(B,undefined,undefined,'certificate')),start,end);
 const j=JSON.parse(core.toJSON(r));assert.deepEqual(j.groups,r.groups);assert.deepEqual(j.metadata,r.metadata);assert.match(j.limits,/metadata validity only/i);assert.match(j.limits,/authentication/i);
 const c=core.toCSV(r);assert.equal(c.split('\r\n').filter(s=>s.startsWith('"evidence"')).length,3);assert.equal(c.split('\r\n').filter(s=>s.startsWith('"window"')).length,r.groups.reduce((n,g)=>n+g.windows.length,0));assert.ok(c.includes(B));assert.ok(c.includes('"overlap"'));
 for(const hostile of ['=1+1','+1','-1','@SUM(1)','\t=1',' \r=1','\n=1']){const altered=structuredClone(r);altered.horizon.startUtc=hostile;assert.ok(core.toCSV(altered).includes('"\''+hostile.replaceAll('"','""')+'"'));}
});
test('seeded minute oracle verifies boundaries and counts across independent application/kind groups',()=>{
 let seed=27112026;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%n;};
 const stamp=n=>new Date(Date.parse('2026-11-27T00:00Z')+n*60000).toISOString().replace(':00.000Z','Z');
 for(let trial=0;trial<80;trial++){
  const intervals=Array.from({length:25},(_,i)=>{const a=random(80)-10;return {a,b:a+1+random(35),app:random(2)?A:B,kind:random(2)?'secret':'certificate',id:i.toString(16).padStart(8,'0')+'-0000-0000-0000-000000000000'};});
  const r=core.reviewCoverage(csv(...intervals.map(e=>row(e.id,stamp(e.a),stamp(e.b),e.kind,e.app))),stamp(0),stamp(60));
  for(const g of r.groups){let gaps=0,overlaps=0;for(let minute=0;minute<60;minute++){const ids=intervals.filter(e=>e.app===g.appId&&e.kind===g.kind&&e.a<=minute&&e.b>minute).map(e=>e.id).sort();const windows=g.windows.filter(w=>Date.parse(w.startUtc)<=Date.parse(stamp(minute))&&Date.parse(w.endUtc)>Date.parse(stamp(minute)));assert.equal(windows.length,1);assert.deepEqual(windows[0].credentialIds,ids);if(ids.length===0)gaps++;if(ids.length>1)overlaps++;}assert.equal(g.gapMinutes,gaps);assert.equal(g.overlapMinutes,overlaps);assert.equal(g.coveredMinutes,60-gaps);}
 }
});
test('1000 nested credentials remain complete without double-counting overlap minutes',t=>{
 const stamp=n=>new Date(Date.parse('2026-11-27T00:00Z')+n*60000).toISOString().replace(':00.000Z','Z');
 const input=csv(...Array.from({length:1000},(_,i)=>row(i.toString(16).padStart(8,'0')+'-0000-0000-0000-000000000000',stamp(i),stamp(2000-i))));const before=performance.now(),r=core.reviewCoverage(input,stamp(0),stamp(2000));
 assert.equal(r.metadata.length,1000);assert.equal(r.groups[0].gapMinutes,0);assert.equal(r.groups[0].overlapMinutes,1998);assert.equal(r.groups[0].coveredMinutes,2000);assert.equal(Math.max(...r.groups[0].windows.map(w=>w.credentialIds.length)),1000);t.diagnostic('1000-row nested review elapsed ms: '+Math.round(performance.now()-before));
});
test('GUID validation rejects quoted trailing line terminators before normalization',()=>{
 for(const terminator of ['\n','\r','\r\n']){
  assert.throws(()=>core.parseMetadata(csv(row()).replace(A,'"'+A+terminator+'"')),/exact GUIDs/);
  assert.throws(()=>core.parseMetadata(csv(row()).replace(B,'"'+B+terminator+'"')),/exact GUIDs/);
 }
});
test('CSV validates selected metadata and normalizes exact GUIDs only',()=>{
 assert.equal(typeof core.parseMetadata,'function','metadata parser exists');
 assert.deepEqual(core.parseMetadata(csv(row(B.toUpperCase(),undefined,undefined,'secret',A.toUpperCase()))),[{appId:A,kind:'secret',credentialId:B,startUtc:'2026-11-01T00:00Z',endUtc:'2026-12-01T00:00Z'}]);
});
