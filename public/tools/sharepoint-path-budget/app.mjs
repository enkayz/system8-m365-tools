import {compare,toJSON,toCSV,parseList,MAX_BYTES} from './core.mjs';
const $=id=>document.getElementById(id);
const a=$('root-a'),b=$('root-b'),paths=$('paths'),check=$('check'),results=$('results'),error=$('error');
let packet=null, generation=0, loading=false, importError='';
function cancelRead(){generation++;loading=false;paths.setAttribute('aria-busy','false');$('file-status').textContent='';}
function invalidate(){packet=null;results.hidden=true;$('rows').replaceChildren();$('download-json').disabled=true;$('download-csv').disabled=true;$('status').textContent='Inputs changed. Check path budgets to create a new handoff.';}
function validate(){
 let valid=false;error.textContent='';
 for(const input of [a,b,paths])input.removeAttribute('aria-invalid');
 if(a.value||b.value||paths.value){try{compare(a.value,b.value,paths.value);valid=true;}catch(e){error.textContent=e.message;const input=e.message.includes('prefix A')?a:e.message.includes('prefix B')?b:paths;input.setAttribute('aria-invalid','true');}}
 check.disabled=!valid||loading||!!importError;if(importError)error.textContent=importError;return valid&&!loading&&!importError;
}
for(const input of [a,b,paths])input.addEventListener('input',()=>{if(input===paths){cancelRead();importError='';$('path-file').value='';}invalidate();validate();});
$('path-file').addEventListener('change',async()=>{
 const file=$('path-file').files[0];if(!file)return;cancelRead();const current=generation;invalidate();importError='';loading=true;paths.setAttribute('aria-busy','true');$('file-status').textContent='Reading local file…';validate();
 try{
  if(!/\.txt$/i.test(file.name))throw new Error('Choose a UTF-8 .txt file; CSV is not accepted.');
  if(file.size>MAX_BYTES)throw new Error('File exceeds 1 MiB.');
  let data;try{data=await file.arrayBuffer();}catch{throw new Error('Could not read the file. Choose it again or paste the list.');}
  if(current!==generation)return;
  let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data);}catch{throw new Error('File is not valid UTF-8. Save it as UTF-8 text and retry.');}
  parseList(text);paths.value=text;$('file-status').textContent='Local file loaded. Check path budgets to create a handoff.';
 }catch(e){if(current!==generation)return;importError=e.message;$('file-status').textContent='Import failed; previous text is preserved. Choose another file or edit the text.';}
 finally{if(current===generation){loading=false;paths.setAttribute('aria-busy','false');validate();}}
});
function budgetText(value){return value?`${value.length} / 400 · headroom ${value.headroom>=0?'+':''}${value.headroom} · reduce by ${value.reduction}`:'Not compared';}
function render(){
 const rows=packet.rows.filter(r=>$('filter').value==='all'||r.needsReview);const fragment=document.createDocumentFragment();
 for(const row of rows){const tr=document.createElement('tr');const pathCell=document.createElement('td');pathCell.textContent=`Line ${row.line}`;const name=document.createElement('span');name.className='path';name.textContent=row.path;pathCell.append(name);tr.append(pathCell);
  for(const value of [row.a,row.b]){const td=document.createElement('td');td.className=value?.reduction?'over':'';td.textContent=budgetText(value);tr.append(td);}
  const review=document.createElement('td');const notes=[];
  if(row.resolvedByB)notes.push('A budget exceedance resolved by B');
  for(const [key,label] of [['duplicateLines','Exact duplicate'],['caseLines','ASCII case match'],['prefixLines','File/folder prefix conflict']])if(row[key].length)notes.push(`${label}: lines ${row[key].join(', ')}`);
  if(row.unicodeReview)notes.push('Unicode: manual destination validation needed');
  if(row.a.reduction||row.b?.reduction)notes.push('Over budget in '+[row.a.reduction?'A':'',row.b?.reduction?'B':''].filter(Boolean).join(' and '));
  if(!notes.length)notes.push('Within compared budgets; no listed conflict. Not a readiness assessment.');
  for(const text of notes){const p=document.createElement('p');p.textContent=text;review.append(p);}tr.append(review);fragment.append(tr);
 }
 $('rows').replaceChildren(fragment);$('row-status').textContent=`Showing ${rows.length} of ${packet.rows.length} rows. Exports contain all rows.`;
}
check.addEventListener('click',()=>{if(!validate())return;packet=compare(a.value,b.value,paths.value);const c=packet.counts;$('summary').textContent=`${c.total} file rows · A over budget: ${c.overA} · B over budget: ${c.overB??'not compared'} · Resolved by B: ${c.resolvedByB} · Needing review: ${c.review} · Ignored empty lines: ${packet.ignoredBlankLines}`;results.hidden=false;render();$('download-json').disabled=false;$('download-csv').disabled=false;$('status').textContent='Path-budget review created. Review the rows before exporting.';$('results-heading').focus();});
$('filter').addEventListener('change',()=>{if(packet)render();});
function save(content,type,extension){const url=URL.createObjectURL(new Blob([content],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`sharepoint-path-budget.${extension}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download-json').addEventListener('click',()=>{if(packet)save(toJSON(packet),'application/json','json');});
$('download-csv').addEventListener('click',()=>{if(packet)save(toCSV(packet),'text/csv;charset=utf-8','csv');});
$('clear').addEventListener('click',()=>{cancelRead();importError='';a.value='';b.value='';paths.value='';$('path-file').value='';$('filter').value='all';invalidate();validate();$('file-status').textContent='';$('status').textContent='Page data cleared. Original files and previous downloads are unchanged.';a.focus();});
