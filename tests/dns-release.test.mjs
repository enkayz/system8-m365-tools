import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('dated DNS worksheet is reachable from archive and returns to tools; exact routes only',async()=>{
 const archive=await readFile(new URL('public/tools/index.html',root),'utf8');
 assert.match(archive,/date-2026-11-24/);assert.doesNotMatch(archive,/date-2026-11-23/);assert.match(archive,/\.\/mail-dns-cutover\//);
 const html=await readFile(new URL('public/tools/mail-dns-cutover/index.html',root),'utf8');
 assert.match(html,/href="\/tools\/"/);
 const nginx=await readFile(new URL('ops/365-tools.nginx.conf',root),'utf8');
 for(const path of ['','index.html','app.mjs','core.mjs','style.css'])assert.ok(nginx.includes('location = /tools/mail-dns-cutover/'+path+' '),path);
 assert.ok(!nginx.includes('location /tools/'));
});
