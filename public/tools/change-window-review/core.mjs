const MINUTE=60000;
const dayNumbers={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
function formatter(timeZone){return new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'longOffset'});}
function localAt(format,time){const p=Object.fromEntries(format.formatToParts(time).map(p=>[p.type,p.value]));return {utc:new Date(time).toISOString().slice(0,16)+'Z',local:`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`,weekday:p.weekday,offset:p.timeZoneName==='GMT'?'UTC+00:00':p.timeZoneName.replace('GMT','UTC'),day:dayNumbers[p.weekday],clock:p.hour+':'+p.minute};}
export const LIMITS=Object.freeze({sites:20,name:80,notes:1000,totalMinutes:1440});
function reject(message){throw new Error(message);}
function validate(input){
 if(!input||typeof input!=='object')reject('Enter a proposed window and site schedules.');
 if(typeof input.start!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(input.start)||!Number.isFinite(Date.parse(input.start))||new Date(Date.parse(input.start)).toISOString().slice(0,16)+'Z'!==input.start)reject('Enter a real UTC start as YYYY-MM-DDTHH:mmZ, year 2000–2099.');
 if(!Number.isInteger(input.executionMinutes)||input.executionMinutes<1||!Number.isInteger(input.rollbackMinutes)||input.rollbackMinutes<0||input.executionMinutes+input.rollbackMinutes>1440)reject('Use whole minutes: execution at least 1, rollback at least 0, combined at most 1440.');
 if(typeof input.notes!=='string'||input.notes.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.notes))reject('Use notes of at most 1000 characters without control characters.');
 if(!Array.isArray(input.sites)||input.sites.length<1||input.sites.length>20)reject('Add between 1 and 20 site schedules.');
 return {start:input.start,executionMinutes:input.executionMinutes,rollbackMinutes:input.rollbackMinutes,notes:input.notes,sites:input.sites.map((site,i)=>{
  const prefix=`Site ${i+1}: `;
  if(!site||typeof site.name!=='string'||!site.name.trim()||site.name.length>80||/[\u0000-\u001f\u007f]/.test(site.name))reject(prefix+'Enter a name of 1–80 characters without control characters.');
  if(typeof site.timeZone!=='string'||site.timeZone.length>100||!/^(?:UTC|[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(site.timeZone))reject(prefix+'Choose a browser-supported IANA time zone, for example Australia/Perth or UTC.');
  try{formatter(site.timeZone);}catch{reject(prefix+'Choose a browser-supported IANA time zone, for example Australia/Perth or UTC.');}
  if(!Array.isArray(site.weekdays)||!site.weekdays.length||site.weekdays.length>7||site.weekdays.some(d=>!Number.isInteger(d)||d<1||d>7)||new Set(site.weekdays).size!==site.weekdays.length)reject(prefix+'Choose one or more distinct working weekdays.');
  if(![site.workStart,site.workEnd].every(t=>typeof t==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))||site.workStart>=site.workEnd)reject(prefix+'Use HH:mm working hours with start before end; overnight hours are unsupported.');
  return {name:site.name,timeZone:site.timeZone,weekdays:[...site.weekdays],workStart:site.workStart,workEnd:site.workEnd};
 })};
}
export function review(raw){
 const input=validate(raw);
 const start=Date.parse(input.start),executionEnd=start+input.executionMinutes*MINUTE,rollbackEnd=executionEnd+input.rollbackMinutes*MINUTE;
 const rows=input.sites.map(site=>{
  const format=formatter(site.timeZone);let executionOverlapMinutes=0,rollbackOverlapMinutes=0;
  for(let t=start;t<rollbackEnd;t+=MINUTE){const p=localAt(format,t);if(site.weekdays.includes(p.day)&&p.clock>=site.workStart&&p.clock<site.workEnd){if(t<executionEnd)executionOverlapMinutes++;else rollbackOverlapMinutes++;}}
  const flags=[];if(executionOverlapMinutes)flags.push('execution overlaps working time');if(rollbackOverlapMinutes)flags.push('rollback overlaps working time');if(!flags.length)flags.push('no working-time overlap in entered schedules');if(input.rollbackMinutes===0)flags.push('rollback allowance is zero');
  return {...site,start:localAt(format,start),executionEnd:localAt(format,executionEnd),rollbackEnd:localAt(format,rollbackEnd),executionOverlapMinutes,rollbackOverlapMinutes,flags};
 });
 return {version:'1.0.0',input,model:'Each elapsed minute in [start, execution end) and [execution end, rollback end) is checked against its actual local weekday and clock time using this browser’s time zone rules. Working intervals include their start and exclude their end.',limits:'Local impact review only. No holidays, calendars or live service reads; no staffing, downtime, authorization, approval or recovery assessment. Does not schedule Microsoft maintenance or make tenant changes.',rows};
}
function csvCell(value){let text=String(value);if(/^[\s\u0000-\u001f]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
function boundaryText(b){return `${b.local} ${b.offset} (${b.weekday})`;}
export function reviewCSV(result){
 const headers=['Site','Time zone','Working weekdays (Mon=1)','Work start','Work end','UTC start','UTC execution end / rollback start','UTC rollback end','Local start','Local execution end / rollback start','Local rollback end','Execution minutes','Rollback minutes','Execution overlap minutes','Rollback overlap minutes','Flags','Notes','Model','Limits'];
 const rows=result.rows.map(s=>[s.name,s.timeZone,s.weekdays.join(' '),s.workStart,s.workEnd,s.start.utc,s.executionEnd.utc,s.rollbackEnd.utc,boundaryText(s.start),boundaryText(s.executionEnd),boundaryText(s.rollbackEnd),result.input.executionMinutes,result.input.rollbackMinutes,s.executionOverlapMinutes,s.rollbackOverlapMinutes,s.flags.join('; '),result.input.notes,result.model,result.limits]);
 return [headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
