import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('local tool declares a connection-denying CSP in addition to the shared server policy',async()=>{
 const html=await readFile(new URL('public/tools/change-window-review/index.html',root),'utf8');
 assert.match(html, /http-equiv="Content-Security-Policy"/);
 assert.ok(html.includes("connect-src 'none'"));
 assert.ok(html.includes("form-action 'none'"));
});
test('dated archive and exact nginx allowlist expose the change-window tool without removing prior routes',async()=>{
 const archive=await readFile(new URL('public/tools/index.html',root),'utf8');
 for(const text of ['date-2026-11-26','datetime="2026-11-26"','./change-window-review/','Microsoft 365 Change Window Review','https://github.com/enkayz/system8-m365-tools/tree/main/public/tools/change-window-review'])assert.ok(archive.includes(text),text);
 assert.ok(archive.indexOf('date-2026-11-26')<archive.indexOf('date-2026-11-25'));
 const nginx=await readFile(new URL('ops/365-tools.nginx.conf',root),'utf8');
 for(const path of ['/tools/change-window-review/','/tools/change-window-review/index.html','/tools/change-window-review/style.css','/tools/change-window-review/core.mjs','/tools/change-window-review/app.mjs'])assert.ok(nginx.includes('location = '+path+' {'),path);
 for(const slug of ['permission-change-review','license-assignment-reconcile','sharepoint-path-budget','mail-dns-cutover','exchange-alias-claims','redirect-uri-audit'])assert.ok(archive.includes('./'+slug+'/'));
 assert.ok(nginx.includes('location / { return 404; }'));
});
