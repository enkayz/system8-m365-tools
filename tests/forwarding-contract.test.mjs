import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../public/tools/forwarding-route-review/',import.meta.url);
test('self-contained four-asset source declares the local-only contract',async()=>{
 assert.deepEqual((await readdir(root)).sort(),['app.mjs','core.mjs','index.html','style.css']);
 const html=await readFile(new URL('index.html',root),'utf8');const app=await readFile(new URL('app.mjs',root),'utf8');const css=await readFile(new URL('style.css',root),'utf8');
 for(const term of ['Trace routes and cycles in a supplied list of mailbox forwarding settings.','not a native Exchange export','ForwardingAddress / ForwardingSmtpAddress','50,000','No sign-in','Version 1.0.0','28 November 2026','https://github.com/enkayz/system8-m365-tools/tree/main/public/tools/forwarding-route-review'])assert.ok(html.includes(term),term);
 assert.doesNotMatch(app,/innerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon/);assert.doesNotMatch(html,/<(?:script|link)[^>]+(?:src|href)="https?:/);
 assert.match(css,/header a:focus-visible\{color:#fff;outline-color:#fff\}/);assert.match(css,/overflow-wrap:anywhere/);
 const doc=await readFile(new URL('../docs/forwarding-route-review.md',import.meta.url),'utf8');for(const term of ['## Changelog','## Input contract','## Algorithm and output contract','## Custody and permissions','## Limitations'])assert.ok(doc.includes(term));
});
