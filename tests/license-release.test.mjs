import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('daily archive exposes dated license tool and keeps earlier permalinks',async()=>{
 const index=await readFile(new URL('public/tools/index.html',root),'utf8');
 for(const marker of ['date-2026-11-21','2026-11-21','./license-assignment-reconcile/','permission-change-review/','redirect-uri-audit/']) assert.ok(index.includes(marker),marker);
 const tool=await readFile(new URL('public/tools/license-assignment-reconcile/index.html',root),'utf8');
 assert.ok(tool.includes('https://github.com/enkayz/system8-m365-tools/tree/main/public/tools/license-assignment-reconcile'));
 assert.ok(tool.includes('1.0.0'));
});
