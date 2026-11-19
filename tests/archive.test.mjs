import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root = new URL('../public/tools/', import.meta.url);
test('dated archive links both local review tool and attributed source-only import', async () => {
 const html = await readFile(new URL('index.html',root),'utf8');
 for (const text of ['2026-11-19','permission-change-review/','redirect-uri-audit/','Imported','No permissions','Source only']) assert.ok(html.includes(text),text);
 const imported = await readFile(new URL('redirect-uri-audit/index.html',root),'utf8');
 for (const text of ['reprise99','MIT','96b1908558c5d5201dbf61c63cedce4c53e8f672','download','AuditLogs','not been run','Log Analytics Reader','P1 or P2']) assert.ok(imported.includes(text),text);
 const license=await readFile(new URL('redirect-uri-audit/LICENSE.txt',root),'utf8');
 assert.match(license,/Copyright \(c\) 2024 reprise99/);
 const query=await readFile(new URL('redirect-uri-audit/Audit-RedirectURIChanged.kql',root),'utf8');
 assert.match(query,/OperationName == "Update service principal"/);
 assert.match(query,/modifiedProperties.displayName == "AppAddress"/);
});
