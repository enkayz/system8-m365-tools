const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function invalid(message) { throw new Error(`Invalid manifest: ${message}`); }
function guid(value) {
  if (typeof value !== 'string' || value.length !== 36 || !GUID.test(value)) invalid('GUIDs must use the exact 36-character hyphenated format.');
  return value.toLowerCase();
}
export const GRAPH_RESOURCE = '00000003-0000-0000-c000-000000000000';
export function resourceLabel(id) { return id === GRAPH_RESOURCE ? 'Microsoft Graph' : 'Resource API'; }
function flatten(snapshot) {
  return snapshot.requiredResourceAccess.flatMap(r => r.resourceAccess.map(p => ({resourceAppId: r.resourceAppId, type: p.type, id: p.id, key: `${r.resourceAppId}|${p.type}|${p.id}`})));
}
export function compareManifests(baselineText, proposedText) {
  const baseline = parseManifest(baselineText);
  const proposed = parseManifest(proposedText);
  if (baseline.snapshot.appId !== proposed.snapshot.appId) throw new Error('Comparison blocked: both manifests must have the same appId.');
  const before = flatten(baseline.snapshot);
  const after = flatten(proposed.snapshot);
  const beforeKeys = new Set(before.map(p => p.key));
  const afterKeys = new Set(after.map(p => p.key));
  const differences = {added: after.filter(p => !beforeKeys.has(p.key)), removed: before.filter(p => !afterKeys.has(p.key)), unchanged: after.filter(p => beforeKeys.has(p.key))};
  return {baseline: baseline.snapshot, proposed: proposed.snapshot, differences, counts: {added: differences.added.length, removed: differences.removed.length, unchanged: differences.unchanged.length}, warnings: {baseline: {duplicatePermissions: baseline.duplicatePermissions, duplicateResources: baseline.duplicateResources}, proposed: {duplicatePermissions: proposed.duplicatePermissions, duplicateResources: proposed.duplicateResources}}};
}
export const DISCLAIMER = 'Configuration is not consent or effective access. Removals do not revoke grants. Scope means delegated configuration; Role means application configuration and requires heightened human review. Permission names are unresolved. Reviewer decisions are notes, not authorization, consent or execution. This tool performs no tenant writes. Downloads contain selected public IDs and reviewer notes; handle as internal.';
export const DECISIONS = Object.freeze(['Review needed', 'Justified', 'Reject']);
export function createPacket(baselineText, proposedText, decisions = []) {
  const comparison = compareManifests(baselineText, proposedText);
  const changed = [...comparison.differences.added.map(p => ({...p, change: 'added'})), ...comparison.differences.removed.map(p => ({...p, change: 'removed'}))];
  const keys = new Set(changed.map(p => p.key));
  const reviewed = new Map();
  if (!Array.isArray(decisions) || decisions.length > changed.length) throw new Error('Invalid review: decisions must match changed permissions.');
  for (const d of decisions) {
    if (!object(d) || !keys.has(d.key) || reviewed.has(d.key) || !DECISIONS.includes(d.decision) || typeof d.reason !== 'string' || d.reason.length > LIMITS.reason) throw new Error('Invalid review: use a listed decision and a reason of at most 2000 characters for each changed permission.');
    reviewed.set(d.key, {decision: d.decision, reason: d.reason});
  }
  return {format: 'system8-permission-change-review', version: 1, ...comparison, decisions: changed.map(p => ({...p, ...(reviewed.get(p.key) ?? {decision: 'Review needed', reason: ''})})), disclaimer: DISCLAIMER};
}
export const LIMITS = Object.freeze({bytes: 1048576, resources: 200, permissions: 2000, reason: 2000});
export function parseManifest(text) {
  if (typeof text !== 'string') invalid('expected JSON text.');
  if (text.length > LIMITS.bytes || new TextEncoder().encode(text).length > LIMITS.bytes) invalid('each input must be at most 1 MiB.');
  let input;
  try { input = JSON.parse(text); } catch { invalid('enter a JSON object exported from an app manifest.'); }
  if (!object(input)) invalid('expected a JSON object.');
  const appId = guid(input.appId);
  if (!Array.isArray(input.requiredResourceAccess)) invalid('requiredResourceAccess must be an explicit array; missing evidence is not an empty configuration.');
  if (input.requiredResourceAccess.length > LIMITS.resources) invalid('maximum 200 resource entries per input.');
  let entries = 0;
  const requiredResourceAccess = input.requiredResourceAccess.map(r => {
    if (!object(r)) invalid('each resource must be an object.');
    const resourceAppId = guid(r.resourceAppId);
    if (!Array.isArray(r.resourceAccess)) invalid('each resourceAccess must be an explicit array.');
    entries += r.resourceAccess.length;
    if (entries > LIMITS.permissions) invalid('maximum 2000 permission entries per input.');
    const resourceAccess = r.resourceAccess.map(p => {
      if (!object(p)) invalid('each permission must be an object.');
      const id = guid(p.id);
      if (p.type !== 'Scope' && p.type !== 'Role') invalid('permission type must be exactly Scope or Role.');
      return {id, type: p.type};
    });
    return {resourceAppId, resourceAccess};
  });
  let duplicatePermissions = 0;
  let duplicateResources = 0;
  const resources = new Map();
  for (const r of requiredResourceAccess) {
    if (resources.has(r.resourceAppId)) duplicateResources++;
    else resources.set(r.resourceAppId, new Map());
    const permissions = resources.get(r.resourceAppId);
    for (const p of r.resourceAccess) {
      const key = `${p.type}|${p.id}`;
      if (permissions.has(key)) duplicatePermissions++;
      else permissions.set(key, p);
    }
  }
  const normalized = [...resources.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([resourceAppId, permissions]) => ({resourceAppId, resourceAccess: [...permissions.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, p]) => p)}));
  return {snapshot: {appId, requiredResourceAccess: normalized}, duplicatePermissions, duplicateResources};
}
