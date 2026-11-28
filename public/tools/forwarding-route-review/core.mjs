export const MAX_BYTES=1048576;
const DOT_ATOM=/^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*$/;
function normalizedAddress(value,rowNumber){
 const parts=value.split('@'),local=parts[0],domain=parts[1];
 const validLabel=label=>label.length<=63&&/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label);
 if(value.length>254||parts.length!==2||!DOT_ATOM.test(local)||local.length>64||!domain||domain.length>253||!domain.split('.').every(validLabel))throw Error(`Row ${rowNumber}: use bare ASCII dot-atom email addresses without spaces or prefixes.`);
 return value.toLowerCase();
}
function parseCSV(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Use UTF-8 CSV of at most 1 MiB.');
 if(text.startsWith('\uFEFF'))text=text.slice(1);
 const records=[];let row=[],field='',state='start';
 const finishField=()=>{row.push(field);field='';state='start';};
 const finishRow=()=>{finishField();records.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(state==='quoted'){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else state='closed';}else field+=c;continue;}
  if(c===','){finishField();continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'){if(text[i+1]!=='\n')throw Error('CSV requires LF or CRLF line endings.');i++;}finishRow();continue;}
  if(state==='closed')throw Error('Invalid CSV: characters after a closing quote.');
  if(c==='"'){if(state!=='start')throw Error('Invalid CSV quote.');state='quoted';}else{field+=c;state='bare';}
 }
 if(state==='quoted')throw Error('Invalid CSV: unclosed quote.');
 if(field||row.length||state!=='start')finishRow();
 if(records[0]?.length!==2||records[0][0]!=='Mailbox'||records[0][1]!=='ForwardTo')throw Error('Use the exact CSV header Mailbox,ForwardTo.');
 if(records.length<2||records.length>501)throw Error('Supply 1–500 mailbox rows.');
 const seen=new Set();
 return records.slice(1).map((r,i)=>{
  if(r.length!==2)throw Error(`Row ${i+2}: exactly two columns required; blank rows are not allowed.`);
  const mailbox=normalizedAddress(r[0],i+2),forwardTo=r[1]===''?'':normalizedAddress(r[1],i+2);
  if(seen.has(mailbox))throw Error(`Row ${i+2}: duplicate Mailbox; supply one effective target per mailbox.`);
  seen.add(mailbox);return {mailbox,forwardTo};
 }).sort((a,b)=>a.mailbox<b.mailbox?-1:a.mailbox>b.mailbox?1:0);
}
export function review(text){
 const input=parseCSV(text);
 const map=new Map(input.map(r=>[r.mailbox,r.forwardTo]));
 let total=0;
 const rows=input.map(({mailbox})=>{
  const route=[],seen=new Map();let node=mailbox,outcome,cycleEntry=null,cycleMembers=[];
  while(true){
   if(++total>50000)throw Error('Review exceeds 50,000 total route entries. Reduce the supplied scope; no partial results were produced.');
   route.push(node);
   if(seen.has(node)){outcome='Cycle reached';cycleEntry=node;cycleMembers=route.slice(seen.get(node),-1);break;}
   seen.set(node,route.length-1);
   if(!map.has(node)){outcome='Unlisted target';break;}
   if(map.get(node)===''){outcome='Listed stop';break;}
   node=map.get(node);
  }
  return {mailbox,route,links:route.length-1,outcome,cycleEntry,cycleMembers,isCycleMember:cycleMembers.includes(mailbox)};
 });
 return {version:'1.0.0',input,rows};
}
export const LIMITATION='Supplied metadata only. A graph cycle is not proof of an endless mail loop or mail loss; Exchange loop prevention and policies affect delivery. No live tenant, alias resolution, group expansion, inbox/transport rules, contacts, delivery-copy settings or forwarding-blocked checks.';
export function exportJSON(data){return JSON.stringify({...data,limitation:LIMITATION},null,2);}
export function exportCSV(data){
 const cell=value=>{let s=String(value??'');if(/^[=+@\-\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const header=['Mailbox','Outcome','Links','Route','CycleEntry','CycleMembers','StartingMailboxInCycle','Limitation'];
 return [header,...data.rows.map(r=>[r.mailbox,r.outcome,r.links,r.route.join(' → '),r.cycleEntry,r.cycleMembers.join(' → '),r.isCycleMember,LIMITATION])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function routesThrough(data,mailbox,includeSelf=false){return data.rows.filter(row=>(includeSelf||row.mailbox!==mailbox)&&row.route.includes(mailbox));}
