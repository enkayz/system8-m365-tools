import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('credential release has dated archive, exact routes, source and version, and documentation',async()=>{
 const archive=await read('public/tools/index.html');
 assert.ok(archive.includes('id="date-2026-11-27"'));
 assert.ok(archive.includes('href="./credential-coverage/"'));
 assert.ok(archive.includes('href="#date-2026-11-27"'));
 const config=await read('ops/365-tools.nginx.conf');
 for(const route of ['','index.html','app.mjs','core.mjs','style.css'])assert.ok(config.includes('location = /tools/credential-coverage/'+route+' {'));
 assert.ok(!config.includes('location /tools/credential-coverage'));
 const html=await read('public/tools/credential-coverage/index.html');
 assert.ok(html.includes('https://github.com/enkayz/system8-m365-tools/tree/main/public/tools/credential-coverage'));
 assert.ok(html.includes('Version 1.0.0'));
 assert.ok((await read('README.md')).includes('## Entra Credential Coverage'));
 assert.ok((await read('docs/credential-coverage.md')).includes('1.0.0'));
});
