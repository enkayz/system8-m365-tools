import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('forwarding release joins dated archive exact routes documentation and source',async()=>{
 const archive=await read('public/tools/index.html');
 for(const s of ['id="date-2026-11-28"','href="#date-2026-11-28"','href="./forwarding-route-review/"','https://github.com/enkayz/system8-m365-tools/tree/main/public/tools/forwarding-route-review'])assert.ok(archive.includes(s),s);
 const conf=await read('ops/365-tools.nginx.conf');
 for(const file of ['','index.html','app.mjs','core.mjs','style.css'])assert.ok(conf.includes('location = /tools/forwarding-route-review/'+file+' {'));
 assert.ok(!conf.includes('location /tools/forwarding-route-review'));
 assert.ok((await read('README.md')).includes('## Exchange Forwarding Route Review'));
 assert.ok((await read('docs/forwarding-route-review.md')).includes('1.0.0'));
});
