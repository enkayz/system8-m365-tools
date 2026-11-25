import {reviewClaims,exportCSV,exportJSON,parseEvidence,decodeEvidence,LIMITS} from './core.mjs';
const $=id=>document.getElementById(id);
let result=null;
function invalidate(){result=null;$('filters').hidden=true;$('filter').value='all';$('search').value='';$('visible-count').textContent='';$('review').hidden=true;document.querySelector('tbody').replaceChildren();$('json').disabled=true;$('csv').disabled=true;$('summary').textContent='Inputs changed. Review both lists again before exporting.';$('error').hidden=true;}
function showError(message){$('error').textContent=message;$('error').hidden=false;$('error').focus();}
function render(){
 const body=document.querySelector('tbody');body.replaceChildren();if(!result)return;
 const query=$('search').value.toLowerCase(),flag=$('filter').value;
 const matching=result.rows.filter(row=>(flag==='all'||row.flags.includes(flag))&&(!query||row.address.includes(query)||row.recipientId.includes(query)));
 $('visible-count').textContent=`Showing ${Math.min(100,matching.length)} of ${matching.length} matching pairs (${result.rows.length} total). First 100 only; downloads always include all rows, regardless of filters.`;
 $('filters').hidden=false;
 for(const row of matching.slice(0,100)){
  const tr=document.createElement('tr');
  for(const value of [row.address,row.recipientId,result.addresses[row.address].existingOwners.join('; ')||'None in supplied list',result.addresses[row.address].requestingOwners.join('; '),row.flags.join('; ')]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);
 }
 $('review').hidden=false;$('json').disabled=false;$('csv').disabled=false;
 $('summary').textContent=`${result.rows.length} unique requested pairs. ${result.current.duplicateCount} duplicate current rows; ${result.requested.duplicateCount} duplicate requested rows collapsed. All flags refer only to supplied evidence.`;
}
$('filter').addEventListener('change',render);
$('search').addEventListener('input',render);
const sides=['current','requested'],generation={current:0,requested:0},pending={current:false,requested:false};
function validateSide(id){
 try{const data=parseEvidence($(id).value);$(id).removeAttribute('aria-invalid');$(id+'-state').textContent=`${data.rowCount} data rows; ${data.duplicateCount} duplicate pairs.`;return true;}
 catch(error){$(id).setAttribute('aria-invalid','true');$(id+'-state').textContent=error.message;return false;}
}
for(const id of sides){
 $(id).setAttribute('aria-describedby',id+'-help '+id+'-state');
 $(id).addEventListener('blur',()=>{if(!pending[id] && $(id).value)validateSide(id);});
 $(id).addEventListener('input',()=>{generation[id]++;pending[id]=false;$(id+'-file').value='';$(id+'-state').textContent='';$(id).removeAttribute('aria-invalid');invalidate();});
 $(id+'-file').addEventListener('change',async()=>{
  const token=++generation[id],file=$(id+'-file').files[0];pending[id]=false;$(id).value='';$(id).removeAttribute('aria-invalid');invalidate();
  $(id+'-state').textContent='';if(!file)return;
  pending[id]=true;$(id+'-state').textContent='Reading local CSV…';
  try{
   if(file.size>LIMITS.bytes)throw new Error('File exceeds 1 MiB. Reduce the evidence file.');
   const bytes=await file.arrayBuffer();if(token!==generation[id])return;
   const text=decodeEvidence(bytes),evidence=parseEvidence(text);
   $(id).value=text;$(id+'-state').textContent=`Loaded ${evidence.rowCount} data rows; ${evidence.duplicateCount} duplicate pairs.`;
  }catch(error){if(token!==generation[id])return;$(id).value='';$(id+'-file').value='';$(id).setAttribute('aria-invalid','true');$(id+'-state').textContent=error.message;}
  finally{if(token===generation[id])pending[id]=false;}
 });
}
$('identity').addEventListener('change',invalidate);
$('claims').addEventListener('submit',event=>{event.preventDefault();invalidate();try{if(sides.some(id=>pending[id]))throw new Error('A local file is still reading. Wait for it to finish or clear the inputs.');for(const id of sides)if(!validateSide(id))throw new Error((id==='current'?'Current recipient CSV: ':'Requested claim CSV: ')+$(id+'-state').textContent);result=reviewClaims($('current').value,$('requested').value,$('identity').checked);render();}catch(error){showError(error.message);}});
$('clear').addEventListener('click',()=>{for(const id of sides){generation[id]++;pending[id]=false;$(id+'-state').textContent='';$(id).removeAttribute('aria-invalid');}$('claims').reset();invalidate();$('summary').textContent='No review yet. Add both CSVs and confirm recipient identity, then review claims.';$('current').focus();});
for(const ext of ['json','csv'])$(ext).addEventListener('click',()=>{
 if(!result)return;
 const blob=new Blob([ext==='json'?exportJSON(result):exportCSV(result)],{type:ext==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='exchange-alias-claims-review.'+ext;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
