import {review,routesThrough,exportJSON,exportCSV} from './core.mjs';
const $=id=>document.getElementById(id);
let result=null,revision=0;
function invalidate(){revision++;$('review').disabled=false;$('file-status').textContent='';result=null;$('results').hidden=true;$('rows').replaceChildren();$('through').replaceChildren(new Option('All starting mailboxes',''));$('self').checked=false;$('json').disabled=$('csv').disabled=true;$('error').hidden=true;$('status').textContent='Input changed. Review again to produce current results.';}
function error(message){$('error').textContent=message;$('error').hidden=false;$('error').focus();}
function text(tag,value,className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;}
function render(){
 if(!result)return;
 const selected=$('through').value,rows=selected?routesThrough(result,selected,$('self').checked):result.rows;
 $('view-count').textContent=`Showing ${Math.min(rows.length,100)} of ${rows.length} matching starting routes. ${result.rows.length} total results in each download.`;
 $('rows').replaceChildren(...rows.slice(0,100).map(r=>{
  const article=document.createElement('article');article.className='result-row';article.append(text('h3',r.mailbox,'result-heading'),text('p',`${r.outcome} · ${r.links} link${r.links===1?'':'s'}`));
  const details=document.createElement('details');details.append(text('summary','View full route for '+r.mailbox),text('p',r.route.join(' → '),'route'));
  if(r.cycleEntry)details.append(text('p','Cycle entry: '+r.cycleEntry),text('p','Cycle members: '+r.cycleMembers.join(' → ')),text('p',r.isCycleMember?'This starting mailbox is a cycle member.':'This starting mailbox is upstream of the cycle, not a cycle member.'));
  article.append(details);return article;
 }));
}
$('input').addEventListener('input',invalidate);$('confirm').addEventListener('change',invalidate);
$('review').addEventListener('click',()=>{
 invalidate();if(!$('confirm').checked){error('Confirm the normalized input scope before reviewing.');return;}
 try{result=review($('input').value);$('summary').textContent=`${result.rows.length} starting mailboxes reviewed in the supplied data.`;for(const row of result.rows)$('through').append(new Option(row.mailbox,row.mailbox));render();$('results').hidden=false;$('json').disabled=$('csv').disabled=false;$('status').textContent='Review complete for the supplied data.';$('results').focus();}catch(e){error(e.message);}
});
$('file').addEventListener('change',async()=>{
 invalidate();const ticket=revision,file=$('file').files[0];if(!file)return;
 if(file.size>1048576){error('Use a UTF-8 file of at most 1 MiB.');return;}
 $('review').disabled=true;$('file-status').textContent='Reading local file…';
 try{
  const buffer=await file.arrayBuffer();if(ticket!==revision)return;
  let value;try{value=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{throw Error('File is not valid UTF-8. Save it as UTF-8 CSV and try again.');}
  $('input').value=value;$('file-status').textContent='Local file loaded. Confirm the scope and choose Review routes.';
 }catch(e){if(ticket===revision){error(e.message.includes('UTF-8')?e.message:'Could not read this file. Choose it again or paste the CSV.');$('file-status').textContent='File not loaded; previous input retained.';}}
 finally{if(ticket===revision)$('review').disabled=false;}
});
$('through').addEventListener('change',render);$('self').addEventListener('change',render);
$('clear').addEventListener('click',()=>{invalidate();$('input').value='';$('file').value='';$('file-status').textContent='';$('confirm').checked=false;$('status').textContent='Cleared. Supply your CSV, confirm its scope, then review.';$('input').focus();});
for(const ext of ['json','csv'])$(ext).addEventListener('click',()=>{if(!result)return;const blob=new Blob([ext==='json'?exportJSON(result):exportCSV(result)],{type:ext==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='forwarding-route-review.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
