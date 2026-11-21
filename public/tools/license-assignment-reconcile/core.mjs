// Deterministic browser/Node core. No I/O or retained input state.
export function reconcile(expectedText, observedText, acknowledged) {
  if (acknowledged !== true) throw new Error('Confirm that both files cover the same tenant and scope.');
  const expected = parseAssignments(expectedText), observed = parseAssignments(observedText);
  const key = p => p.userPrincipalName+'|'+p.skuId;
  const e = new Map(expected.assignments.map(p => [key(p),p]));
  const o = new Map(observed.assignments.map(p => [key(p),p]));
  const counts = {'Expected only':0,'Observed only':0,'In both':0};
  const rows = [...new Set([...e.keys(),...o.keys()])].sort().map(k => {
    const comparison = e.has(k) ? o.has(k) ? 'In both' : 'Expected only' : 'Observed only';
    counts[comparison]++;
    const p = e.get(k) || o.get(k);
    return {userPrincipalName:p.userPrincipalName, skuId:p.skuId, comparison};
  });
  return {schemaVersion:1, sameTenantAndScopeAcknowledged:true, limits:{maxBytesPerInput:1048576,maxRowsPerInput:5000}, interpretation:'Pair membership only, not effective entitlement, assignment path, service plans, pricing or proof of inventory completeness. No tenant changes or rollback.', expected,observed,counts,rows};
}
export function exportCsv(packet) {
  const cell = value => '"'+(/^[=+\-@\t\r\n']/.test(value) ? "'"+value : value).replaceAll('"','""')+'"';
  return [['UserPrincipalName','SkuId','Comparison'],...packet.rows.map(p => [p.userPrincipalName,p.skuId,p.comparison])].map(row => row.map(cell).join(',')).join('\r\n')+'\r\n';
}
function csvRows(text) {
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  const fail = () => {throw new Error('Malformed CSV. Use two fields per row and RFC4180 quoting.');};
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {if (text[i+1] === '"') {field += '"'; i++;} else {quoted = false; closed = true;}}
      else field += c;
    } else if (c === '"') {if (field || closed) fail(); quoted = true;}
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false;
      if (c !== ',') {if (c === '\r' && text[i+1] === '\n') i++; rows.push(row); row = [];}
    } else {if (closed) fail(); field += c;}
  }
  if (quoted) fail();
  if (field || closed || row.length) {row.push(field); rows.push(row);}
  return rows;
}
export function parseAssignments(text) {
  if (typeof text !== 'string' || !text.isWellFormed()) throw new Error('Input must be valid UTF-8 text.');
  if (new TextEncoder().encode(text).length > 1048576) throw new Error('Maximum 1 MiB UTF-8 per input.');
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length > 5001) throw new Error('Maximum 5,000 assignment rows per input.');
  const headers = (rows.shift() || []).map(x => x.toLowerCase());
  const u = headers.indexOf('userprincipalname'), s = headers.indexOf('skuid');
  if (headers.length !== 2 || u < 0 || s < 0) throw new Error('CSV headers must be exactly UserPrincipalName,SkuId; no extra or duplicate columns.');
  if (!rows.length) throw new Error('At least one assignment is required; empty inventories are not supported.');
  for (const row of rows) {
    if (row.length !== 2) throw new Error('CSV rows must each contain exactly two fields.');
    if (row.some(value => /[\u0000-\u001f\u007f-\u009f]/u.test(value))) throw new Error('CSV fields cannot contain control characters.');
  }
  const pairs = new Map();
  for (const row of rows) {
    if (/[^\x20-\x7e]/.test(row[u].trim())) throw new Error('Invalid UPN. Only ASCII identities are supported.');
    const userPrincipalName = row[u].trim().toLowerCase();
    const raw = row[s];
    const [local, domain, extra] = userPrincipalName.split('@');
    const atom = /^[a-z0-9'!#^~_-]+(?:\.[a-z0-9'!#^~_-]+)*$/;
    const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    if (userPrincipalName.length > 254 || !local || local.length > 64 || !atom.test(local) || !domain || extra !== undefined || !domain.includes('.') || !domain.split('.').every(x => label.test(x))) throw new Error('Invalid UPN. Use an ASCII user@domain.name identity with valid dot-separated names.');
    const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    const guidShape = /^.{8}-.{4}-.{4}-.{4}-.{12}$/.test(raw);
    if (!guid && (guidShape || !/^[A-Za-z0-9_-]+$/.test(raw))) throw new Error('Invalid SKU. Use an exact GUID or an unpadded SKU part number (letters, digits, underscore or hyphen).');
    const skuId = guid ? raw.toLowerCase() : raw;
    pairs.set(userPrincipalName+'|'+skuId, {userPrincipalName,skuId});
  }
  return {rowCount:rows.length, duplicateCount:rows.length-pairs.size, assignments:[...pairs.values()].sort((a,b) => a.userPrincipalName < b.userPrincipalName ? -1 : a.userPrincipalName > b.userPrincipalName ? 1 : a.skuId < b.skuId ? -1 : a.skuId > b.skuId ? 1 : 0)};
}
