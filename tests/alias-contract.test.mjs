import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEvidence,decodeEvidence,reviewClaims,exportCSV} from '../public/tools/exchange-alias-claims/core.mjs';
const root=new URL('../public/tools/exchange-alias-claims/',import.meta.url);
const A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const csv=rows=>'RecipientId,Address\n'+rows.join('\n');
const id=i=>i.toString(16).padStart(8,'0')+'-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('documented maximum rows, address lengths and aggregate owner boundary are exact',()=>{
 const rows=Array.from({length:5000},(_,i)=>A+',a'+i+'@example.test');
 assert.equal(parseEvidence(csv(rows)).rowCount,5000);assert.equal(reviewClaims(csv(rows),csv(rows),true).rows.length,5000);
 const local='a'.repeat(64),domain=['b'.repeat(63),'c'.repeat(63),'d'.repeat(61)].join('.');
 const address=local+'@'+domain;assert.equal(address.length,254);assert.equal(parseEvidence(csv([A+','+address])).rows[0].address,address);
 assert.throws(()=>parseEvidence(csv([A+','+address+'x'])));
 const bytes=new Uint8Array(1048576).fill(65);assert.equal(decodeEvidence(bytes).length,1048576);assert.throws(()=>decodeEvidence(new Uint8Array(1048577)),/1 MiB/);
 const current=csv(Array.from({length:50},(_,i)=>id(i)+',shared@example.test'));
 const requested=csv(Array.from({length:200},(_,i)=>id(i)+',shared@example.test'));
 assert.equal(reviewClaims(current,requested,true).ownerReferences,50000);
 assert.throws(()=>reviewClaims(current,requested+'\n'+id(200)+',shared@example.test',true),/50000/);
});
test('simultaneous unseen owners retain not-seen and competition flags; every formula prefix is protected',()=>{
 const review=reviewClaims(csv([A+',different@example.test']),csv([A+',absent@example.test',B+',absent@example.test']),true);
 assert.deepEqual(review.rows[0].flags,['multiple-request-owner conflict','not seen in supplied current list']);
 for(const prefix of ['=','+','-']){const r=reviewClaims(csv([A+',old@example.test']),csv([B+','+prefix+'formula@example.test']),true);assert.ok(exportCSV(r).includes('"\''+prefix+'formula@example.test"'));}
 for(const address of ['a@bad..test','.a@example.test','a.@example.test','a@bad_.test','a@x.test.','a@example.test\t','a@例.test','"quoted"@example.test','SMTP:a@example.test','x500:/o=example'])assert.throws(()=>parseEvidence(csv([A+','+address])));
 for(const suffix of [',','\n\n','\r','\n"bad'])assert.throws(()=>parseEvidence(csv([A+',valid@example.test'])+suffix));
});
test('static artifact enforces custody, dependency-free shell and inspectable versioned scope',async()=>{
 const html=await readFile(new URL('index.html',root),'utf8'),app=await readFile(new URL('app.mjs',root),'utf8'),core=await readFile(new URL('core.mjs',root),'utf8');
 for(const directive of ["default-src 'none'","script-src 'self'","style-src 'self'","connect-src 'none'","form-action 'none'","base-uri 'none'"])assert.ok(html.includes(directive));
 assert.match(html,/Version 1\.0\.0/);assert.match(html,/2026-11-25/);assert.match(html,/not proof of tenant uniqueness/);assert.match(html,/Deleted, hidden, hybrid/);assert.match(html,/No permissions, admin consent/);assert.match(html,/original inventory requires separate customer authority/);
 assert.doesNotMatch(app+core,/\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|sendBeacon)\b/);
 assert.doesNotMatch(app,/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(/);
 assert.equal((html.match(/<script\b/g)||[]).length,1);assert.match(html,/<script type="module" src="app.mjs"><\/script>/);
 assert.doesNotMatch(html,/<textarea[^>]*>[^<]+<\/textarea>/);
});
