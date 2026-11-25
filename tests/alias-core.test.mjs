import test from 'node:test';
import assert from 'node:assert/strict';
const core = await import('../public/tools/exchange-alias-claims/core.mjs').catch(()=>({}));
const A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', C='cccccccc-cccc-cccc-cccc-cccccccccccc';
const csv=(rows)=>'RecipientId,Address\n'+rows.join('\n');
test('strict evidence rejects unsupported syntax and bounds before comparison',()=>{
 const bad=['','RecipientId,Address',csv([A+',SMTP:user@example.test']),csv([A+', user@example.test']),csv([' '+A+',user@example.test']),csv([A+',user@example.test ']),csv([A+',a..b@example.test']),csv([A+',"a b"@example.test']),csv([A+',a@localhost']),csv([A+',a@-bad.test']),csv([A+',é@example.test']),csv([A+',mailto:a@example.test']),csv([A+',<img>@example.test']),csv(['display name,a@example.test']),csv([A+',a@example.test,extra']),csv([A+',a@example.test','',''+B+',b@example.test']),csv([A+',a@example.test\u0000']), 'Address,RecipientId\nuser@example.test,'+A, '"RecipientId,Address\n'+A+',a@example.test', csv(Array(5001).fill(A+',a@example.test')), 'x'.repeat(1048577)];
 for(const value of bad) assert.throws(()=>core.parseEvidence(value),undefined,JSON.stringify(value.slice(0,100)));
 assert.throws(()=>core.parseEvidence(csv([A+','+'a'.repeat(65)+'@example.test'])));
 assert.throws(()=>core.decodeEvidence(new Uint8Array([0xff])),/UTF-8/);
 assert.equal(core.decodeEvidence(new TextEncoder().encode('abc')),'abc');
 const good=core.parseEvidence('\ufeff"RecipientId","Address"\r\n"'+A+'","a+b!#$%&\'*/=?^_`{|}~@example.test"\r\n');
 assert.equal(good.rowCount,1);
 assert.equal(core.parseEvidence(csv([A+',a@example.test',A.toUpperCase()+',A@EXAMPLE.TEST'])).duplicateCount,1);
});
test('review joins cross-owner claims with independent flags and deduplicated owner sets',()=>{
 assert.equal(typeof core.reviewClaims,'function');
 const current=csv([A+',shared@example.test',B+',shared@example.test',A+',shared@example.test']);
 const plan=csv([A+',shared@example.test',C+',shared@example.test',C+',shared@example.test',B+',absent@example.test']);
 assert.throws(()=>core.reviewClaims(current,plan,false),/same tenant/);
 const r=core.reviewClaims(current,plan,true);
 assert.equal(r.rows.length,3);assert.equal(r.current.duplicateCount,1);assert.equal(r.requested.duplicateCount,1);
 assert.deepEqual(r.addresses['shared@example.test'],{existingOwners:[A,B],requestingOwners:[A,C]});
 assert.deepEqual(r.rows[0],{address:'shared@example.test',recipientId:A,flags:['current-other-owner conflict','multiple-request-owner conflict','current-same-owner']});
 assert.deepEqual(r.rows[2].flags,['not seen in supplied current list']);
 const repeated=core.reviewClaims(csv([A+',a@example.test']),csv([A+',a@example.test',A+',a@example.test']),true);
 assert.deepEqual(repeated.rows[0].flags,['current-same-owner']);
 const crowded=csv(Array.from({length:225},(_,i)=>i.toString(16).padStart(8,'0')+'-aaaa-aaaa-aaaa-aaaaaaaaaaaa,a@example.test'));
 assert.throws(()=>core.reviewClaims(crowded,crowded,true),/50000/);
});
test('explicit review exports carry all rows, custody notice and formula-safe CSV addresses',()=>{
 assert.equal(typeof core.exportCSV,'function');assert.equal(typeof core.exportJSON,'function');
 const plan=csv(Array.from({length:120},(_,i)=>A+',=claim'+i+'@example.test'));
 const r=core.reviewClaims(csv([B+',x@example.test']),plan,true);
 assert.deepEqual(JSON.parse(core.exportJSON(r)),r);
 const output=core.exportCSV(r);assert.equal(output.split('\r\n').length,122);
 assert.match(output,/"'=claim119@example.test"/);assert.match(output,/Review only/);assert.match(output,/not seen in supplied current list/);
 assert.equal(r.rows.length,120);
});
test('CSV evidence parses exact headers, GUIDs and bare ASCII SMTP into normalized pairs',()=>{
 assert.equal(typeof core.parseEvidence,'function');
 assert.deepEqual(core.parseEvidence(csv([A.toUpperCase()+',User@Example.TEST'])),{rows:[{recipientId:A,address:'user@example.test'}],rowCount:1,duplicateCount:0});
});
