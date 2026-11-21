import test from 'node:test';
import assert from 'node:assert/strict';
const core = await import('../public/tools/license-assignment-reconcile/core.mjs').catch(() => ({}));
const csv = rows => 'UserPrincipalName,SkuId\r\n'+rows.join('\r\n');
test('reconciles acknowledged scope into normalized allowlisted JSON and formula-safe CSV', () => {
  assert.equal(typeof core.reconcile, 'function');
  const expected = csv(['a@b.com,E3','-b@b.com,-SKU','a@b.com,E3']);
  const observed = csv(['c@b.com,E5','a@b.com,E3']);
  assert.throws(() => core.reconcile(expected,observed,false), /same tenant and scope/);
  assert.throws(() => core.reconcile(expected,observed,'true'), /same tenant and scope/);
  const packet = core.reconcile(expected,observed,true);
  assert.deepEqual(Object.keys(packet), ['schemaVersion','sameTenantAndScopeAcknowledged','limits','interpretation','expected','observed','counts','rows']);
  assert.deepEqual(packet.counts, {'Expected only':1,'Observed only':1,'In both':1});
  assert.deepEqual(packet.rows, [{userPrincipalName:'-b@b.com',skuId:'-SKU',comparison:'Expected only'},{userPrincipalName:'a@b.com',skuId:'E3',comparison:'In both'},{userPrincipalName:'c@b.com',skuId:'E5',comparison:'Observed only'}]);
  assert.equal(packet.expected.duplicateCount,1);
  assert.equal(core.exportCsv(packet), '"UserPrincipalName","SkuId","Comparison"\r\n"\'-b@b.com","\'-SKU","Expected only"\r\n"a@b.com","E3","In both"\r\n"c@b.com","E5","Observed only"\r\n');
  assert.deepEqual(core.reconcile(expected,observed,true),packet);
});
test('bounds bytes and assignment rows, rejecting malformed Unicode before normalization', () => {
  assert.throws(() => core.parseAssignments('x'.repeat(1048577)), /1 MiB/);
  assert.throws(() => core.parseAssignments('é'.repeat(524289)), /1 MiB/);
  assert.throws(() => core.parseAssignments(csv(Array(5001).fill('a@b.com,E3'))), /5,000/);
  assert.equal(core.parseAssignments(csv(Array(5000).fill('a@b.com,E3'))).duplicateCount,4999);
  assert.throws(() => core.parseAssignments(csv(['K@b.com,E3'])), /UPN/);
  assert.throws(() => core.parseAssignments(csv(['a@b.com,E3\ud800'])), /UTF-8/);
});
test('validates identities and exact SKU identifiers before normalization', () => {
  for (const upn of ['x','a@@b.com','.a@b.com','a..b@b.com','a.@b.com','a b@b.com','a@-b.com','a@b-.com','a@b..com','a@b','a@b_com','a'.repeat(65)+'@b.com','é@b.com','<img>@b.com']) assert.throws(() => core.parseAssignments(csv([upn+',E3'])), /UPN/);
  for (const sku of ['', ' E3','E3 ','{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}','E3+X','zzzzzzzz-aaaa-aaaa-aaaa-aaaaaaaaaaaa']) assert.throws(() => core.parseAssignments(csv(['a@b.com,'+sku])), /SKU/);
  assert.equal(core.parseAssignments(csv(["O'NEIL@EXAMPLE.COM,SPE_e3"])).assignments[0].skuId, 'SPE_e3');
});
test('rejects ambiguous, malformed, extra or empty inventory without echoing content', () => {
  const bad = ['', 'UserPrincipalName,SkuId', 'UserPrincipalName,SkuId\n', 'UserPrincipalName,SkuId,Secret\na@b.com,E3,PRIVATE', 'UserPrincipalName,UserPrincipalName\na@b.com,E3', 'UPN,SkuId\na@b.com,E3', csv(['a@b.com,E3,extra']), csv(['a@b.com']), csv(['"a@b.com,E3']), csv(['a@b.com,"E3"tail']), csv(['a@b.com,E3','','b@b.com,E3']), csv(['a@b.com,"E3\r\nX"']), csv(['a@b.com,E3\u0000'])];
  for (const input of bad) assert.throws(() => core.parseAssignments(input), /CSV|header|assignment|control/i);
});
test('normalizes CSV assignment pairs with BOM, quoted fields, CRLF and set duplication counts', () => {
  assert.equal(typeof core.parseAssignments, 'function');
  const result = core.parseAssignments('\uFEFF"UserPrincipalName","sKuId"\r\n" Alice@Example.com ","SPE_E3"\r\nalice@example.com,SPE_E3\r\nbob@example.com,AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA\r\n');
  assert.deepEqual(result, {rowCount:3, duplicateCount:1, assignments:[{userPrincipalName:'alice@example.com',skuId:'SPE_E3'},{userPrincipalName:'bob@example.com',skuId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}]});
});
