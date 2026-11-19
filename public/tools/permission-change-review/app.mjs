import {parseManifest, compareManifests, resourceLabel, createPacket, DECISIONS, LIMITS} from './core.mjs';
const $ = id => document.getElementById(id);
const sides = ['baseline', 'proposed'];
const generations = {baseline: 0, proposed: 0};
const fileErrors = {baseline: '', proposed: ''};
let comparison = null;
function invalidate(message = 'Inputs changed. Compare again to start a new review.') {
  comparison = null;
  $('results').hidden = true;
  $('download').disabled = true;
  for (const kind of ['added', 'removed', 'unchanged']) $(`${kind}-list`).replaceChildren();
  $('status').textContent = message;
}
function validate(side) {
  const input = $(side);
  let valid = false;
  let error = fileErrors[side];
  if (input.value) {
    try {parseManifest(input.value); valid = true;}
    catch (e) {error = e.message;}
  }
  $(`${side}-error`).textContent = error;
  input.setAttribute('aria-invalid', String(Boolean(error)));
  return valid;
}
function validateBoth() {
  const valid = sides.map(validate);
  $('compare').disabled = !valid.every(Boolean);
}
for (const side of sides) {
  $(side).addEventListener('input', () => {generations[side]++; fileErrors[side] = ''; $(side).setAttribute('aria-busy', 'false'); $(`${side}-file`).value = ''; invalidate(); validateBoth();});
  $(`${side}-file`).addEventListener('change', async () => {
    const generation = ++generations[side];
    const file = $(`${side}-file`).files[0];
    if (!file) return;
    fileErrors[side] = '';
    invalidate();
    $(side).value = '';
    validateBoth();
    $(side).setAttribute('aria-busy', 'false');
    if (file.size > LIMITS.bytes) {
      fileErrors[side] = 'Invalid manifest: each input must be at most 1 MiB.';
      validateBoth();
      return;
    }
    $(side).setAttribute('aria-busy', 'true');
    $('status').textContent = `Reading ${side} file locally…`;
    try {
      const content = await file.text();
      if (generation !== generations[side]) return;
      $(side).value = content;
      validateBoth();
      $('status').textContent = 'File loaded. Compare when both manifests are valid.';
    } catch {
      if (generation !== generations[side]) return;
      fileErrors[side] = 'Could not read the file. Choose it again or paste the JSON.';
      validateBoth();
      $('status').textContent = 'File could not be read. Choose it again or paste the JSON.';
    } finally {
      if (generation === generations[side]) $(side).setAttribute('aria-busy', 'false');
    }
  });
}
function text(tag, content, className) {
  const element = document.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  return element;
}
function render(kind, entries) {
  const list = $(`${kind}-list`);
  if (!entries.length) {list.append(text('li', `No ${kind} configured permissions.`)); return;}
  for (const p of entries) {
    const item = document.createElement('li');
    item.append(text('p', `${p.type === 'Role' ? 'Application' : 'Delegated'} configuration · ${p.type}`, 'permission-title'));
    item.append(text('p', `${resourceLabel(p.resourceAppId)} · ${p.resourceAppId}`, 'permission-id'));
    item.append(text('p', `Unresolved permission name · ${p.id}`, 'permission-id'));
    if (p.type === 'Role') item.append(text('p', 'Application configuration requires heightened human review.', 'role-note'));
    if (kind !== 'unchanged') {
      const index = document.querySelectorAll('[data-review]').length;
      item.dataset.review = p.key;
      const label = text('label', 'Review decision');
      const select = document.createElement('select');
      select.id = `decision-${index}`;
      label.htmlFor = select.id;
      for (const decision of DECISIONS) select.append(text('option', decision));
      const reasonLabel = text('label', 'Review reason');
      const reason = document.createElement('textarea');
      reason.id = `reason-${index}`;
      reasonLabel.htmlFor = reason.id;
      reason.maxLength = LIMITS.reason;
      reason.rows = 2;
      reason.className = 'review-reason';
      reason.setAttribute('aria-describedby', `reason-help-${index}`);
      const help = text('p', 'Optional human note · maximum 2,000 characters. No credentials or secrets.', 'help');
      help.id = `reason-help-${index}`;
      item.append(label, select, reasonLabel, reason, help);
    }
    list.append(item);
  }
}
$('compare').addEventListener('click', () => {
  invalidate();
  try {
    comparison = compareManifests($('baseline').value, $('proposed').value);
    $('app-id').textContent = comparison.baseline.appId;
    for (const kind of ['added', 'removed', 'unchanged']) {
      $(`count-${kind}`).textContent = comparison.counts[kind];
      render(kind, comparison.differences[kind]);
    }
    $('duplicates').textContent = sides.map(side => `${side === 'baseline' ? 'Baseline' : 'Proposed'}: ${comparison.warnings[side].duplicatePermissions} duplicate permissions, ${comparison.warnings[side].duplicateResources} repeated resource blocks.`).join(' ');
    $('results').hidden = false;
    $('download').disabled = false;
    $('status').textContent = 'Comparison ready. Review the configured changes below.';
    $('results-heading').focus();
  } catch (e) {invalidate(e.message);}
});
$('clear').addEventListener('click', () => {
  for (const side of sides) {generations[side]++; fileErrors[side] = ''; $(side).setAttribute('aria-busy', 'false'); $(side).value = ''; $(`${side}-file`).value = '';}
  invalidate('Inputs and review cleared. Original files and earlier downloads are unchanged.');
  validateBoth();
  $('baseline').focus();
});
$('download').addEventListener('click', () => {
  if (!comparison) return;
  let url;
  try {
    const decisions = [...document.querySelectorAll('[data-review]')].map(item => ({key: item.dataset.review, decision: item.querySelector('select').value, reason: item.querySelector('textarea').value}));
    const packet = createPacket($('baseline').value, $('proposed').value, decisions);
    url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2) + '\n'], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'permission-change-review.json';
    link.click();
    $('status').textContent = 'Review JSON download requested. Handle the packet as internal information.';
  } catch (e) { $('status').textContent = e.message; }
  finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
});
validateBoth();
