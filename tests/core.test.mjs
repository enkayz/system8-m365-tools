import test from 'node:test';
import assert from 'node:assert/strict';
const core = await import('../public/tools/permission-change-review/core.mjs').catch(() => ({}));
const APP = '11111111-1111-1111-1111-111111111111';
const GRAPH = '00000003-0000-0000-c000-000000000000';
const P1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const P2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const manifest = (rows = [], extra = {}) => JSON.stringify({appId: APP, requiredResourceAccess: rows, ...extra});
const resource = (id = P1, type = 'Scope', resourceAppId = GRAPH) => ({resourceAppId, resourceAccess: [{id, type}]});

test('bounds bytes, resources and total permission entries before comparison', () => {
  assert.throws(() => core.parseManifest(' '.repeat(1048577)), /Invalid manifest: .*1 MiB/);
  assert.throws(() => core.parseManifest('é'.repeat(524289)), /Invalid manifest: .*1 MiB/);
  assert.throws(() => core.parseManifest(manifest(Array.from({length: 201}, () => ({resourceAppId: GRAPH, resourceAccess: []})))), /Invalid manifest: .*200 resource/);
  const oversized = {resourceAppId: GRAPH, resourceAccess: Array.from({length: 2001}, () => ({id: P1, type: 'Scope'}))};
  assert.throws(() => core.parseManifest(manifest([oversized])), /Invalid manifest: .*2000 permission/);
  assert.throws(() => core.parseManifest({}), /Invalid manifest: /);
  assert.equal(core.parseManifest(manifest()+' '.repeat(1048576-manifest().length)).snapshot.appId, APP);
});

test('set normalization merges duplicate resources, warns on duplicate permissions and sorts deterministically', () => {
  const mixed = manifest([resource(P2, 'Role'), resource(), resource(P1.toUpperCase()), {resourceAppId: GRAPH.toUpperCase(), resourceAccess: [{id: P1, type: 'Role'}]}]);
  const result = core.parseManifest(mixed);
  assert.equal(result.duplicateResources, 3);
  assert.equal(result.duplicatePermissions, 1);
  assert.deepEqual(result.snapshot.requiredResourceAccess, [{resourceAppId: GRAPH, resourceAccess: [{id: P1, type: 'Role'}, {id: P2, type: 'Role'}, {id: P1, type: 'Scope'}]}]);
  const reverse = JSON.parse(mixed); reverse.requiredResourceAccess.reverse();
  assert.deepEqual(core.parseManifest(JSON.stringify(reverse)), result);
});

test('compares exact resource-type-id tuples with same-app guard and deterministic set counts', () => {
  assert.equal(typeof core.compareManifests, 'function', 'comparison is implemented');
  const other = '22222222-2222-2222-2222-222222222222';
  const before = manifest([resource(), resource(P2, 'Role')]);
  const after = manifest([resource(P2, 'Role'), resource(P1, 'Role'), resource(P1, 'Scope', other)]);
  const result = core.compareManifests(before, after);
  assert.deepEqual(result.counts, {added: 2, removed: 1, unchanged: 1});
  assert.deepEqual(result.differences.removed, [{resourceAppId: GRAPH, type: 'Scope', id: P1, key: `${GRAPH}|Scope|${P1}`}]);
  assert.equal(result.differences.added[0].type, 'Role');
  assert.equal(result.differences.added[1].resourceAppId, other);
  assert.throws(() => core.compareManifests(before, manifest([], {appId: other})), /same appId/);
  assert.throws(() => core.compareManifests(before, '{}'), /Invalid manifest/);
  const reordered = JSON.parse(after); reordered.requiredResourceAccess.reverse();
  assert.deepEqual(core.compareManifests(before, JSON.stringify(reordered)), result);
  assert.deepEqual(core.compareManifests(manifest(), manifest()).counts, {added: 0, removed: 0, unchanged: 0});
  assert.equal(core.resourceLabel(GRAPH), 'Microsoft Graph');
  assert.equal(core.resourceLabel(other), 'Resource API');
  assert.equal(core.resourceLabel('__proto__'), 'Resource API');
});

test('exports normalized change review evidence, bounded reviewer decisions and configuration disclaimer only', () => {
  assert.equal(typeof core.createPacket, 'function', 'packet export is implemented');
  const before = manifest([resource(P1, 'Scope')], {displayName: '<img src=x onerror=alert(1)>', passwordCredentials: [{secretText: 'PRIVATE-SECRET'}]});
  const after = manifest([resource(P1, 'Role')]);
  const key = `${GRAPH}|Role|${P1}`;
  const packet = core.createPacket(before, after, [{key, decision: 'Justified', reason: 'Approved by owner <script>not executable</script>', extra: 'PRIVATE-SECRET'}]);
  assert.deepEqual(packet.decisions.map(d => [d.change, d.decision]), [['added', 'Justified'], ['removed', 'Review needed']]);
  assert.equal(packet.decisions[0].reason, 'Approved by owner <script>not executable</script>');
  assert.equal(packet.decisions[1].reason, '');
  assert.deepEqual(packet.baseline, core.parseManifest(before).snapshot);
  assert.deepEqual(packet.proposed, core.parseManifest(after).snapshot);
  assert.match(packet.disclaimer, /Configuration is not consent or effective access/);
  assert.match(packet.disclaimer, /Removals do not revoke grants/);
  assert.equal(JSON.stringify(packet).includes('PRIVATE-SECRET'), false);
  assert.equal(JSON.stringify(packet).includes('displayName'), false);
  assert.throws(() => core.createPacket(before, after, [{key, decision: 'Approved', reason: ''}]), /Invalid review/);
  assert.throws(() => core.createPacket(before, after, [{key: '__proto__', decision: 'Reject', reason: ''}]), /Invalid review/);
  assert.throws(() => core.createPacket(before, after, [{key, decision: 'Reject', reason: 'x'.repeat(2001)}]), /Invalid review/);
  assert.throws(() => core.createPacket(before, after, [{key, decision: 'Reject', reason: ''}, {key, decision: 'Reject', reason: ''}]), /Invalid review/);
  assert.throws(() => core.createPacket(before, after, null), /Invalid review/);
  assert.throws(() => core.createPacket(before, after, [{key, decision: 'Justified', reason: null}]), /Invalid review/);
  assert.equal(core.createPacket(manifest(), manifest()).decisions.length, 0);
});

test('normalizes validated GUID case and retains only selected permission evidence', () => {
  assert.equal(typeof core.parseManifest, 'function', 'parseManifest is implemented');
  const result = core.parseManifest(manifest([resource(P1.toUpperCase(), 'Scope', GRAPH.toUpperCase())], {displayName: 'PRIVATE', passwordCredentials: [{secretText: 'SECRET'}], '__proto__': {polluted: true}}));
  assert.deepEqual(result, {snapshot: {appId: APP, requiredResourceAccess: [resource()]}, duplicatePermissions: 0, duplicateResources: 0});
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  assert.equal({}.polluted, undefined);
});

test('refuses missing, malformed or ambiguous schema with generic errors, accepting explicit empty arrays', () => {
  const bad = ['not-json-SECRET', '', 'null', '[]', '{}', manifest([], {appId: null}), manifest([], {appId: ` ${APP}`}), manifest([], {appId: APP + '\\n'}), manifest([], {appId: 7}), JSON.stringify({appId: APP}), manifest(null), manifest({}), manifest([null]), manifest([{}]), manifest([resource('not-a-guid')]), manifest([resource(P1, 'scope')]), manifest([resource(P1, 'Role ')]), manifest([resource(P1, null)]), manifest([resource(P1, 'Scope', ' '+GRAPH)]), manifest([{resourceAppId: GRAPH, resourceAccess: null}]), manifest([{resourceAppId: GRAPH}]), manifest([{resourceAppId: GRAPH, resourceAccess: [null]}]), '{"__proto__":{"polluted":true},"appId":"'+APP+'"}', manifest([resource()], {appId: {toString: 'bad'}})];
  for (const text of bad) {
    assert.throws(() => core.parseManifest(text), e => e instanceof Error && /^Invalid manifest: /.test(e.message) && !e.message.includes('SECRET'), `must reject ${text}`);
  }
  assert.deepEqual(core.parseManifest(manifest()).snapshot.requiredResourceAccess, []);
  assert.deepEqual(core.parseManifest(manifest([{resourceAppId: GRAPH, resourceAccess: []}])).snapshot.requiredResourceAccess, [{resourceAppId: GRAPH, resourceAccess: []}]);
  const proto = core.parseManifest('{"__proto__":{"polluted":true},"appId":"'+APP+'","requiredResourceAccess":[]}');
  assert.equal(Object.hasOwn(proto.snapshot, '__proto__'), false);
  assert.equal({}.polluted, undefined);
});
