import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../public/tools/change-window-review/',import.meta.url);
test('static delivery uses only local assets and no persistence or content network APIs',async()=>{
 assert.deepEqual((await readdir(root)).sort(),['app.mjs','core.mjs','index.html','style.css']);
 const html=await readFile(new URL('index.html',root),'utf8');const app=await readFile(new URL('app.mjs',root),'utf8');const core=await readFile(new URL('core.mjs',root),'utf8');const css=await readFile(new URL('style.css',root),'utf8');
 assert.ok(html.includes('lang="en"'));assert.match(html,/<form[^>]+novalidate/);assert.match(html,/role="alert"/);assert.match(html,/role="status"/);assert.match(html,/<details>/);assert.match(html,/no overnight shifts/i);assert.match(html,/No holidays/);assert.match(html,/No sign-in/);assert.match(html,/System8/);
 assert.doesNotMatch(html,/<(?:iframe|object|embed)\b|\son[a-z]+\s*=|<script(?![^>]*src=)/i);assert.doesNotMatch(html,/(?:src|href)="https?:/i);
 assert.doesNotMatch(app+core,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|sendBeacon|eval)\s*(?:\(|\.)|innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.cookie|serviceWorker/);
 assert.doesNotMatch(css,/@import|url\(|animation|scroll-behavior/);assert.match(css,/:focus-visible/);assert.match(css,/minmax\(0,1fr\)/);
});
test('handoff documentation states exact supported bounds and local-only limitations',async()=>{
 const path=new URL('../docs/change-window-review.md',import.meta.url);let doc='';try{doc=await readFile(path,'utf8');}catch{}assert.ok(doc,'Handoff documentation exists');
 for(const phrase of ['2000–2099','1440','20 sites','CHANGE_WINDOW_TOOL_URL','CHANGE_WINDOW_EVIDENCE_DIR','No publication','holidays','formula','build-research.md'])assert.ok(doc.includes(phrase),phrase);
});
