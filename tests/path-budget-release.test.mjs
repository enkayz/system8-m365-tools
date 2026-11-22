import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('archive connects the dated path-budget tool without displacing prior routes',async()=>{
 const index=await readFile(new URL('public/tools/index.html',root),'utf8');
 for(const marker of ['date-2026-11-22','2026-11-22','./sharepoint-path-budget/','license-assignment-reconcile/','permission-change-review/','redirect-uri-audit/'])assert.ok(index.includes(marker),marker);
 const nginx=await readFile(new URL('ops/365-tools.nginx.conf',root),'utf8');
 for(const path of ['/tools/sharepoint-path-budget/','/tools/sharepoint-path-budget/index.html','/tools/sharepoint-path-budget/core.mjs','/tools/sharepoint-path-budget/app.mjs','/tools/sharepoint-path-budget/style.css'])assert.ok(nginx.includes('location = '+path+' {'),path);
 const readme=await readFile(new URL('README.md',root),'utf8');assert.ok(readme.includes('SharePoint Path Budget'));
});
