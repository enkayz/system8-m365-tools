import {reviewCoverage,parseMetadata,toJSON,toCSV} from './core.mjs';
const $=id=>document.getElementById(id);
let report=null,revision=0,loading=false;
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function table(id,title,headers,rows,limit){
 const help=el('p',`Showing ${Math.min(rows.length,limit)} of ${rows.length} rows. All rows are included in downloads.`,'help');
 const heading=el('h3',title);
 const wrap=el('div',undefined,'table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',title+' — scroll horizontally for all columns');
 const table=el('table');table.id=id;const caption=el('caption',title+' (all times UTC)');const head=el('thead'),tr=el('tr');
 for(const label of headers){const th=el('th',label);th.scope='col';tr.append(th);}head.append(tr);const body=el('tbody');
 for(const cells of rows.slice(0,limit)){const row=el('tr');cells.forEach((cell,i)=>{const [text,kind]=Array.isArray(cell)?cell:[cell];const td=el('td',String(text),kind);td.dataset.label=headers[i];row.append(td);});body.append(row);}
 table.append(caption,head,body);wrap.append(table);$('result-tables').append(heading,help,wrap);
}
function render(){
 $('metadata').scrollLeft=0;
 const groups=report.groups,windows=groups.flatMap(g=>g.windows.map(w=>({appId:g.appId,kind:g.kind,...w}))),evidence=groups.flatMap(g=>g.evidence);
 $('summary').textContent=`${report.metadata.length} credential rows · ${groups.length} application/kind group${groups.length===1?'':'s'} · ${report.horizon.startUtc} to ${report.horizon.endUtc} (end excluded).`;
 $('result-tables').replaceChildren();
 table('groups','Application/kind totals',['AppId','Kind','Credentials','Gap minutes','Covered minutes','Overlap minutes'],groups.map(g=>[[g.appId,'id'],g.kind,g.evidence.length,g.gapMinutes,g.coveredMinutes,g.overlapMinutes]),100);
 table('windows','Validity windows',['AppId','Kind','Window','Start UTC','End UTC (excluded)','Duration','Distinct credentials'],windows.map(w=>[[w.appId,'id'],w.kind,[w.type==='gap'?'Gap':w.type==='overlap'?'Overlap':'Single credential','window-'+w.type],[w.startUtc,'utc'],[w.endUtc,'utc'],w.minutes+' min',[w.credentialIds.length+' · '+(w.credentialIds.slice(0,3).join('; ')||'No supplied credential')+(w.credentialIds.length>3?' · remaining IDs in export':''),'ids']]),100);
 table('evidence','Supplied evidence',['AppId','Kind','CredentialId','Original start UTC','Original end UTC','Horizon relation','Clipped start UTC','Clipped end UTC'],evidence.map(e=>[[e.appId,'id'],e.kind,[e.credentialId,'id'],[e.startUtc,'utc'],[e.endUtc,'utc'],e.relation,[e.clippedStartUtc??'Outside horizon','utc'],[e.clippedEndUtc??'Outside horizon','utc']]),100);
 $('results').hidden=false;$('status').textContent='Review calculated from supplied metadata only.';$('results').focus();
}
const urls=new Set();
function invalidate(){
 revision++;loading=false;$('review').disabled=false;
 $('json').disabled=true;$('csv').disabled=true;for(const url of urls)URL.revokeObjectURL(url);urls.clear();
 report=null;$('results').hidden=true;$('result-tables').replaceChildren();$('summary').textContent='';$('error').hidden=true;$('error').textContent='';$('status').textContent='Inputs changed. Review again to calculate coverage.';
}
for(const extension of ['json','csv'])$(''+extension).addEventListener('click',()=>{
 if(!report)return;
 const content=extension==='json'?toJSON(report):toCSV(report),url=URL.createObjectURL(new Blob([content],{type:extension==='json'?'application/json':'text/csv;charset=utf-8'}));urls.add(url);
 const link=el('a');link.href=url;link.download='entra-credential-coverage.'+extension;document.body.append(link);link.click();link.remove();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000);
});
$('clear').addEventListener('click',()=>{
 invalidate();$('plan').reset();$('metadata').value='';$('start').value='';$('end').value='';$('file').value='';$('status').textContent='Inputs and review cleared. Original files and earlier downloads are unchanged.';$('metadata').focus();
});
$('file').addEventListener('change',async()=>{
 const file=$('file').files[0];invalidate();$('file').value='';if(!file)return;
 $('metadata').value='';const ticket=revision;loading=true;$('review').disabled=true;$('status').textContent='Reading metadata file locally…';
 let text='',message='';
 if(file.size>1048576)message='CSV must not exceed 1 MiB UTF-8.';
 else{
  let buffer;
  try{buffer=await file.arrayBuffer();}catch{message='The file could not be read. Choose it again or paste UTF-8 CSV metadata.';}
  if(!message){try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{message='The file must contain valid UTF-8 CSV. Save it as UTF-8 and try again.';}}
  if(!message){try{parseMetadata(text);}catch(error){message=error.message;}}
 }
 if(ticket!==revision)return;
 loading=false;$('review').disabled=false;
 if(message){$('error').textContent=message;$('error').hidden=false;$('error').focus();$('status').textContent='File not loaded. Choose corrected metadata or paste CSV.';}
 else{$('metadata').value=text;$('status').textContent='Metadata file loaded. Check the UTC horizon, then review coverage.';}
});
$('plan').addEventListener('input',invalidate);
$('plan').addEventListener('focusout',event=>{
 if(!['metadata','start','end'].includes(event.target.id))return;
 try{
  if(event.target.id==='metadata')parseMetadata($('metadata').value);
  else if($('metadata').value&&$('start').value&&$('end').value)reviewCoverage($('metadata').value,$('start').value,$('end').value);
 }catch(error){$('error').textContent=error.message;$('error').hidden=false;}
});
$('plan').addEventListener('submit',event=>{
 event.preventDefault();if(loading)return;invalidate();
 try{report=reviewCoverage($('metadata').value,$('start').value,$('end').value);render();$('json').disabled=false;$('csv').disabled=false;}
 catch(error){report=null;$('results').hidden=true;$('result-tables').replaceChildren();$('error').textContent=error.message;$('error').hidden=false;$('error').focus();$('status').textContent='Review blocked. Correct the inputs and review again.';}
});
