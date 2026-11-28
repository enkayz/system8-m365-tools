import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const path=new URL('../public/tools/forwarding-route-review/core.mjs',import.meta.url);
let core; if(existsSync(path))core=await import(path);
test('CSV correctness, exact address validation, duplicates and bounds fail closed',()=>{
 const ok=core.review('\uFEFFMailbox,ForwardTo\r\n"A@EXAMPLE.COM",""\r\n');assert.equal(ok.rows[0].mailbox,'a@example.com');
 for(const text of ['Mailbox,ForwardTo\na@example.com,\n\n','Mailbox,ForwardTo\n"a@example.com"x,','Mailbox,ForwardTo\n"a@example.com,','Mailbox,ForwardTo\na@example.com,,','Mailbox,ForwardTo\na@example.com,\nA@EXAMPLE.COM,','Mailbox,ForwardTo\n a@example.com,','Mailbox,ForwardTo\na..b@example.com,','Mailbox,ForwardTo\nSMTP:a@example.com,','Mailbox,ForwardTo\na@-example.com,','Mailbox,ForwardTo\na@exämple.com,','Mailbox,ForwardTo\na@example.com,\r','Mailbox,ForwardTo','Mailbox,ForwardTo\na@example.com,\n'+ 'x'.repeat(1048576)])assert.throws(()=>core.review(text));
 assert.throws(()=>core.review('Mailbox,ForwardTo\n'+Array.from({length:501},(_,i)=>`a${i}@example.com,`).join('\n')),/500/);
});
test('cycle entry, cycle members, unlisted targets and reverse traversal are explicit',()=>{
 assert.equal(typeof core.routesThrough,'function');
 const data=core.review('Mailbox,ForwardTo\nz@example.com,a@example.com\na@example.com,b@example.com\nb@example.com,a@example.com\ns@example.com,s@example.com\nu@example.com,missing@example.com\nt@example.com,');
 const row=data.rows.find(r=>r.mailbox==='z@example.com');assert.equal(row.outcome,'Cycle reached');assert.deepEqual(row.route,['z@example.com','a@example.com','b@example.com','a@example.com']);assert.deepEqual(row.cycleMembers,['a@example.com','b@example.com']);assert.equal(row.cycleEntry,'a@example.com');assert.equal(row.isCycleMember,false);assert.equal(row.links,3);
 assert.equal(data.rows[0].isCycleMember,true);assert.equal(data.rows.find(r=>r.mailbox==='s@example.com').links,1);assert.equal(data.rows.find(r=>r.mailbox==='u@example.com').outcome,'Unlisted target');
 assert.deepEqual(core.routesThrough(data,'a@example.com',false).map(r=>r.mailbox),['b@example.com','z@example.com']);assert.equal(core.routesThrough(data,'a@example.com',true).length,3);
 const reversed=core.review('Mailbox,ForwardTo\n'+data.input.toReversed().map(r=>r.mailbox+','+r.forwardTo).join('\n'));assert.deepEqual(reversed,data);
});
test('full exports neutralize formulas while retaining every route',()=>{
 assert.equal(typeof core.exportCSV,'function');
 const data=core.review('Mailbox,ForwardTo\n=SUM@EXAMPLE.COM,x@example.com\nx@example.com,\ny@example.com,x@example.com');
 assert.equal(data.rows.length,3);assert.ok(core.exportCSV(data).includes('"\'=sum@example.com"'));assert.equal(JSON.parse(core.exportJSON(data)).rows.length,3);assert.match(core.exportCSV(data),/y@example.com/);
 assert.equal(core.routesThrough(data,'x@example.com').length,2);
 assert.throws(()=>core.review('Mailbox,ForwardTo\n'+Array.from({length:500},(_,i)=>`a${i}@example.com,a${(i+1)%500}@example.com`).join('\n')),/50,000/);
});
test('shared tails, self cycle and address/export boundaries stay explicit',()=>{
 const r=core.review('Mailbox,ForwardTo\na@example.com,t@example.com\nb@example.com,t@example.com\nt@example.com,\ns@example.com,s@example.com');assert.deepEqual(r.rows[0].route,['a@example.com','t@example.com']);assert.deepEqual(r.rows[1].route,['b@example.com','t@example.com']);assert.deepEqual(r.rows[2].route,['s@example.com','s@example.com']);
 for(const start of ['=','+','-'])assert.ok(core.exportCSV(core.review(`Mailbox,ForwardTo\n${start}test@example.com,`)).includes(`"'${start}test@example.com"`));
 for(const address of ['a'.repeat(65)+'@example.com','a@'+ 'x'.repeat(64)+'.com','a@example..com','a@example.com.','a@exa_mple.com','"a"@example.com','a@example.com\t','a@example.com ','a@example.com\u0000'])assert.throws(()=>core.review('Mailbox,ForwardTo\n'+address+','));
 const max='a'.repeat(64)+'@'+['b'.repeat(63),'c'.repeat(63),'d'.repeat(61)].join('.');assert.equal(max.length,254);assert.equal(core.review('Mailbox,ForwardTo\n'+max+',').rows.length,1);assert.throws(()=>core.review('Mailbox,ForwardTo\n'+max+'x,'));
});
test('strict input to deterministic listed-stop route',()=>{
 assert.ok(core,'forwarding core exists');
 const r=core.review('Mailbox,ForwardTo\r\nB@EXAMPLE.COM,\r\na@example.com,b@example.com\r\n');
 assert.equal(r.rows.length,2);assert.deepEqual(r.rows[0].route,['a@example.com','b@example.com']);assert.equal(r.rows[0].outcome,'Listed stop');assert.equal(r.rows[0].links,1);
});
