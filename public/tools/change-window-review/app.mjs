import {review,reviewCSV} from './core.mjs';
let snapshot=null;
const $=selector=>document.querySelector(selector);
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function field(parent,text,className,value,type='text'){const label=element('label',text);const input=element('input');input.type=type;input.className=className;input.value=value;input.autocomplete='off';if(type==='time')input.step='60';label.append(input);parent.append(label);return input;}
function updateSites(){
 const sites=[...document.querySelectorAll('.site')];sites.forEach((site,i)=>{site.querySelector('legend').textContent=`Site ${i+1}`;const remove=site.querySelector('.remove-site');remove.setAttribute('aria-label',`Remove site ${i+1}`);remove.disabled=sites.length===1;});$('#add-site').disabled=sites.length>=20;$('#site-count').textContent=`${sites.length} of 20 sites`;
}
function makeSite(){
 const index=document.querySelectorAll('.site').length+1;
 const site=element('fieldset',undefined,'site');site.append(element('legend',`Site ${index}`));
 const fields=element('div',undefined,'site-fields');field(fields,'Site name','site-name',`Site ${index}`);field(fields,'IANA time zone','site-zone','Australia/Perth');field(fields,'Working start (local)','work-start','09:00','time');field(fields,'Working end (local)','work-end','17:00','time');site.append(fields);
 const help=element('p','One within-day interval only: start must be before end. Overnight shifts are not supported. Time zone examples: Australia/Perth, Europe/London, America/New_York or UTC.','help');site.append(help);
 const weekdays=element('fieldset',undefined,'weekdays');weekdays.append(element('legend','Local working weekdays'));
 days.forEach((day,i)=>{const label=element('label');const input=element('input');input.type='checkbox';input.value=String(i+1);input.checked=i<5;label.append(input,document.createTextNode(day));weekdays.append(label);});site.append(weekdays);
 const remove=element('button','Remove site','remove-site');remove.type='button';remove.addEventListener('click',()=>{if(document.querySelectorAll('.site').length<=1)return;const next=site.nextElementSibling||site.previousElementSibling;site.remove();updateSites();invalidate();next.querySelector('.site-name').focus();});site.append(remove);$('#sites').append(site);updateSites();return site;
}
function readPlan(){return {start:$('#start').value,executionMinutes:Number($('#execution').value),rollbackMinutes:$('#rollback').value===''?NaN:Number($('#rollback').value),notes:$('#notes').value,sites:[...document.querySelectorAll('.site')].map(s=>({name:s.querySelector('.site-name').value,timeZone:s.querySelector('.site-zone').value,weekdays:[...s.querySelectorAll('.weekdays input:checked')].map(i=>Number(i.value)),workStart:s.querySelector('.work-start').value,workEnd:s.querySelector('.work-end').value}))};}
function showResults(result){
 snapshot=result;$('#json').disabled=false;$('#csv').disabled=false;
 $('#site-results').replaceChildren();$('#summary').textContent=`${result.rows.length} site${result.rows.length===1?'':'s'} reviewed. Execution and rollback counts are separate.`;
 const first=result.rows[0];$('#utc-window').replaceChildren();
 for(const [label,key] of [['UTC execution starts','start'],['UTC execution end / rollback start','executionEnd'],['UTC rollback end','rollbackEnd']]){const time=element('time',first[key].utc,'utc-boundary');time.dateTime=first[key].utc;const value=element('dd');value.append(time);$('#utc-window').append(element('dt',label),value);}
 result.rows.forEach(s=>{
  const card=element('article',undefined,'site-result');card.append(element('h3',s.name),element('p',`${s.timeZone} · ${s.weekdays.map(d=>days[d-1]).join(', ')} · ${s.workStart}–${s.workEnd} local`,'help'));
  const counts=element('div',undefined,'phase-counts');for(const [name,value,total,className] of [['Execution',s.executionOverlapMinutes,result.input.executionMinutes,'execution-count'],['Rollback',s.rollbackOverlapMinutes,result.input.rollbackMinutes,'rollback-count']]){const p=element('p',undefined,className);p.append(element('strong',`${value} of ${total} minutes`),document.createTextNode(name+' overlaps working time'));counts.append(p);}card.append(counts);
  const boundaries=element('dl');for(const [label,key] of [['Execution starts','start'],['Execution ends / rollback starts','executionEnd'],['Rollback allowance ends','rollbackEnd']]){const b=s[key];boundaries.append(element('dt',label),element('dd',`${b.local} ${b.offset} (${b.weekday})`));}card.append(boundaries);
  const flags=element('ul',undefined,'flags');s.flags.forEach(flag=>flags.append(element('li',flag)));card.append(flags);$('#site-results').append(card);
 });$('#results').hidden=false;$('#status').textContent='Review calculated from the entered schedules only.';$('#results').focus();
}
function invalidate(){
 snapshot=null;$('#json').disabled=true;$('#csv').disabled=true;
 $('#results').hidden=true;$('#site-results').replaceChildren();$('#summary').textContent='';$('#utc-window').textContent='';$('#error').hidden=true;$('#error').textContent='';$('#status').textContent='Inputs changed. Review again to calculate local impact.';
}
function showError(error,focus=false){$('#error').textContent=error.message;$('#error').hidden=false;if(focus)$('#error').focus();}
$('#plan').addEventListener('input',invalidate);
$('#plan').addEventListener('change',invalidate);
$('#plan').addEventListener('focusout',event=>{if(event.target.matches('input,textarea')&&$('#start').value){try{review(readPlan());}catch(error){showError(error);}}});
$('#plan').addEventListener('submit',event=>{event.preventDefault();invalidate();try{showResults(review(readPlan()));}catch(error){showError(error,true);}});
$('#add-site').addEventListener('click',()=>{if(document.querySelectorAll('.site').length>=20)return;const site=makeSite();invalidate();site.querySelector('.site-name').focus();});
function download(extension){
 if(!snapshot)return;
 try{const text=extension==='json'?JSON.stringify(snapshot,null,2):reviewCSV(snapshot);const blob=new Blob([text],{type:extension==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=element('a');link.href=url;link.download=`change-window-review.${extension}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{showError(new Error('Export could not be created. Review the inputs and try again.'),true);}
}
$('#clear').addEventListener('click',()=>{
 $('#plan').reset();$('#sites').replaceChildren();makeSite();invalidate();$('#status').textContent='Inputs and review cleared. Enter a new UTC start to review another window.';$('#start').focus();
});
$('#json').addEventListener('click',()=>download('json'));
$('#csv').addEventListener('click',()=>download('csv'));
makeSite();
