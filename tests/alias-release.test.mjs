import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('dated alias archive joins exact static nginx allowlist without a catchall',async()=>{
 const archive=await readFile(new URL('public/tools/index.html',root),'utf8');
 assert.equal((archive.match(/id="date-2026-11-25"/g)||[]).length,1);
 assert.ok(archive.includes('href="./exchange-alias-claims/"'));
 assert.ok(archive.includes('href="#date-2026-11-25"'));
 for(const old of ['mail-dns-cutover','sharepoint-path-budget','license-assignment-reconcile','permission-change-review','redirect-uri-audit'])assert.ok(archive.includes('./'+old+'/'));
 const nginx=await readFile(new URL('ops/365-tools.nginx.conf',root),'utf8');
 for(const path of ['', 'index.html','style.css','app.mjs','core.mjs'])assert.ok(nginx.includes('location = /tools/exchange-alias-claims/'+path+' {'));
 assert.ok(!nginx.includes('location /tools/'));
 assert.ok(nginx.includes('if ($request_method !~ ^(GET|HEAD)$)'));
 assert.ok(nginx.includes('if ($args != "")'));
 const readme=await readFile(new URL('README.md',root),'utf8');
 assert.ok(readme.includes('## Exchange Alias Claim Review — 1.0.0 (2026-11-25)'));
 assert.ok(readme.includes('ALIAS_TOOL_URL'));
});
