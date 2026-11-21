import {parseAssignments,reconcile,exportCsv} from './core.mjs';
const $ = id => document.getElementById(id);
const sides = ['expected','observed'];
const state = Object.fromEntries(sides.map(side => [side,{generation:0,valid:false,loading:false}]));
let packet = null;
function invalidate() {
  packet = null;
  $('results').hidden = true;
  $('rows').replaceChildren();
  $('download-json').disabled = $('download-csv').disabled = true;
}
function readiness() {
  const ready = sides.every(s => state[s].valid && !state[s].loading) && $('scope').checked;
  $('compare').disabled = !ready;
  $('status').textContent = ready ? 'Ready to compare assignments.' : 'Add valid assignment lists and confirm the same tenant and scope.';
}
function validate(side) {
  const input = $(side), error = $(side+'-error');
  state[side].valid = false;
  try {
    if (input.value) {parseAssignments(input.value);state[side].valid = true;}
    error.textContent = '';
  } catch (e) {error.textContent = e.message;}
  input.setAttribute('aria-invalid', String(Boolean(error.textContent)));
  readiness();
}
for (const side of sides) {
  $(side+'-file').addEventListener('change',async () => {
    const generation = ++state[side].generation;
    invalidate();state[side].valid=false;state[side].loading=false;
    const file = $(side+'-file').files[0];
    if (!file) {validate(side);return;}
    const fail = message => {
      state[side].loading=false;state[side].valid=false;
      $(side).setAttribute('aria-busy','false');$(side).setAttribute('aria-invalid','true');
      $(side+'-error').textContent=message;readiness();
    };
    if (file.size > 1048576) {fail('Maximum 1 MiB UTF-8 per input. Choose a smaller file.');return;}
    state[side].loading=true;$(side).setAttribute('aria-busy','true');$(side+'-error').textContent='';
    readiness();$('status').textContent=`Reading ${side} CSV locally…`;
    let buffer;
    try {buffer=await file.arrayBuffer();}
    catch {if(generation===state[side].generation) fail('Could not read this file. Try opening it again or paste its CSV.');return;}
    if (generation !== state[side].generation) return;
    let text;
    try {text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}
    catch {fail('File must be valid UTF-8. Export it as UTF-8 CSV and try again.');return;}
    try {parseAssignments(text);}
    catch (e) {fail(e.message);return;}
    state[side].loading=false;$(side).setAttribute('aria-busy','false');$(side).value=text;validate(side);
  });
  $(side).addEventListener('input',() => {
    state[side].generation++;
    state[side].loading = false;
    $(side).setAttribute('aria-busy','false');
    $(side+'-file').value = '';
    invalidate();validate(side);
  });
}
$('scope').addEventListener('change',() => {invalidate();readiness();});
function renderRows() {
  const filter = $('filter').value;
  const rows = packet.rows.filter(row => filter === 'All' || row.comparison === filter);
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const value of [row.userPrincipalName,row.skuId,row.comparison]) {
      const td = document.createElement('td');td.textContent=value;tr.append(td);
    }
    fragment.append(tr);
  }
  $('rows').replaceChildren(fragment);
  $('row-status').textContent = `Showing ${rows.length} of ${packet.rows.length} pairs. Downloads include all pairs.`;
}
$('filter').addEventListener('change',() => {if (packet) renderRows();});
$('compare').addEventListener('click',() => {
  invalidate();
  if (sides.some(s=>!state[s].valid || state[s].loading)) return;
  try {
    packet = reconcile($('expected').value,$('observed').value,$('scope').checked);
    for (const [id,label] of [['expected','Expected only'],['observed','Observed only'],['both','In both']]) $('count-'+id).textContent = packet.counts[label];
    $('duplicates').textContent = sides.map(s => `${s==='expected'?'Expected':'Observed'}: ${packet[s].rowCount} rows, ${packet[s].assignments.length} unique pairs, ${packet[s].duplicateCount} duplicate rows`).join('. ')+'. Duplicates count once.';
    $('filter').value = 'All';renderRows();$('results').hidden = false;
    $('download-json').disabled = $('download-csv').disabled = false;
    $('status').textContent = 'Comparison ready for human review. No tenant changes were made.';
    $('results-heading').focus();
  } catch (e) {invalidate();$('status').textContent = e.message;}
});
$('clear').addEventListener('click',() => {
  invalidate();
  for (const side of sides) {
    state[side].generation++;state[side].loading=false;state[side].valid=false;
    $(side).value='';$(side+'-file').value='';$(side+'-error').textContent='';
    $(side).setAttribute('aria-busy','false');$(side).setAttribute('aria-invalid','false');
  }
  $('scope').checked=false;readiness();$('expected-file').focus();
});
for (const format of ['json','csv']) $('download-'+format).addEventListener('click',() => {
  if (!packet) return;
  let url;
  try {
    const content = format === 'json' ? JSON.stringify(packet,null,2)+'\n' : exportCsv(packet);
    url = URL.createObjectURL(new Blob([content],{type:format==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='license-assignment-reconcile.'+format;link.click();
    $('status').textContent = `Requested ${format.toUpperCase()} download. Keep downloaded identities within your authorized handoff.`;
  } catch { $('status').textContent='Could not create the download. Try again or copy the source inputs before reloading.'; }
  finally {if(url) setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
readiness();
