import test from 'node:test';
import assert from 'node:assert/strict';
const core = await import('../public/tools/sharepoint-path-budget/core.mjs').catch(()=>({}));
test('literal decoded A/B paths preserve input and calculate inclusive 400 boundary',()=>{
 assert.equal(typeof core.compare,'function');
 const r=core.compare('sites/A/Docs','sites/B/D','x'.repeat(387)+'\n'+'x'.repeat(388));
 assert.equal(r.rows[0].a.length,400);assert.equal(r.rows[0].a.headroom,0);
 assert.equal(r.rows[1].a.length,401);assert.equal(r.rows[1].a.reduction,1);
 assert.equal(r.rows[1].resolvedByB,true);assert.equal(r.rows[1].b.length,398);
 const literal=core.compare('sites/A/Docs','','a%20b.txt');
 assert.equal(literal.rows[0].a.length,22);assert.equal(literal.rows[0].b,null);
});
test('strict literal validation refuses repair while disclosing ignored blanks and preserving line IDs',()=>{
 for(const root of ['', '/sites/A','sites/A/','https://host/sites/A','sites/A?x',' sites/A','sites/A ','sites//A','sites/./A','C:/A','sites\\A','sites/../A','sites/\u0000A']) assert.throws(()=>core.compare(root,'','a.txt'),/prefix/i,root);
 for(const path of ['/a','C:/a','a\\b','a//b','./a','a/../b','a\u0000b',' a','a ','a\rb']) assert.throws(()=>core.compare('sites/A','',path),/line 1/i,path);
 assert.throws(()=>core.compare('sites/A',' ','a'),/prefix B/i);
 const r=core.compare('sites/A','','\na,b.txt\r\n\n"x".txt\n');
 assert.deepEqual(r.rows.map(x=>[x.line,x.path]),[[2,'a,b.txt'],[4,'"x".txt']]);assert.equal(r.ignoredBlankLines,3);
 assert.throws(()=>core.compare('sites/A','','\n'),/file path/i);
 assert.throws(()=>core.compare('sites/A','','a\n'.repeat(5001)),/5,000/);
 assert.throws(()=>core.compare('sites/A','','a'.repeat(1048577)),/1 MiB/);
});
test('within-list duplicate, ASCII-case and file-as-folder conflicts retain related physical line IDs regardless of roots',()=>{
 const r=core.compare('sites/A','s/D','Docs\n\nDocs/a.txt\ndocs/A.txt\nDocs\nelse.txt');
 assert.deepEqual(r.rows[0].duplicateLines,[5]);assert.deepEqual(r.rows[0].prefixLines,[3,4]);
 assert.deepEqual(r.rows[1].caseLines,[4]);assert.deepEqual(r.rows[1].prefixLines,[1,5]);
 assert.equal(r.rows[0].needsReview,true);assert.equal(r.rows.at(-1).needsReview,false);
 assert.deepEqual(core.compare('s/D','','Docs\n\nDocs/a.txt\ndocs/A.txt\nDocs\nelse.txt').rows[1].prefixLines,[1,5]);
 const unicode=core.compare('sites/😀','','plain.txt\nÉ.txt');
 assert.equal(unicode.rows[0].a.length,'sites/😀/plain.txt'.length);assert.equal(unicode.rows[0].unicodeReview,true);assert.equal(unicode.rows[1].unicodeReview,true);
 assert.equal(unicode.counts.review,2);
});
test('literal hash and question-mark file names are not mistaken for URL queries; bounded deep paths remain usable',()=>{
 const r=core.compare('sites/A','','Reports/a#b.txt\nReports/a?b.txt\n'+'a/'.repeat(12000)+'file.txt');
 assert.equal(r.rows[0].path,'Reports/a#b.txt');assert.equal(r.rows[1].path,'Reports/a?b.txt');assert.equal(r.rows[2].needsReview,true);
});
test('dense conflicts and oversized destination prefixes fail closed with bounded-work recovery',()=>{
 assert.throws(()=>core.compare('sites/A','','a.txt\n'.repeat(225)),/50,000.*related-line|related-line.*50,000/);
 assert.throws(()=>core.compare('a'.repeat(4097),'','a.txt'),/4,096/);
 assert.equal(core.compare('sites/A','','a.txt\nb.txt').rows.length,2);
});
test('explicit JSON and CSV handoffs retain all rows, scenarios and formula-safe literal values',()=>{
 assert.equal(typeof core.toCSV,'function');assert.equal(typeof core.toJSON,'function');
 const r=core.compare('sites/A','=B/Docs','=SUM(1,2).txt\n-thing.txt\n<img src=x onerror=alert(1)>');
 assert.deepEqual(JSON.parse(core.toJSON(r)),r);
 const csv=core.toCSV(r);assert.match(csv,/"'=SUM\(1,2\).txt"/);assert.match(csv,/"'-thing.txt"/);assert.match(csv,/"'=B\/Docs"/);
 assert.match(csv,/a_length/);assert.match(csv,/prefix_lines/);assert.match(csv,/<img src=x onerror=alert\(1\)>/);
});
