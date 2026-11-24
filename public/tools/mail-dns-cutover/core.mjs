function timestamp(value, label) {
 const m=typeof value==='string'&&value.length<=35&&value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/);
 if(!m) throw new Error(`${label}: use ISO date and time with seconds and Z or an explicit offset.`);
 const [,y,mo,d,h,mi,s,,zone]=m; const year=+y,month=+mo,day=+d;
 const leap=year%4===0&&(year%100!==0||year%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(year<1||month<1||month>12||day<1||day>days[month-1]||+h>23||+mi>59||+s>59||(zone!=='Z'&&(+zone.slice(1,3)>23||+zone.slice(4)>59))) throw new Error(`${label}: invalid calendar date, time or offset.`);
 const n=Date.parse(value); if(!Number.isFinite(n)) throw new Error(`${label}: invalid timestamp.`);return n;
}
export const ASSUMPTIONS=Object.freeze([
 'Entered lowering time means the lower TTL was visible on ALL authoritative servers; this is user-supplied evidence, not verified by this worksheet.',
 'No DNS lookup or DNS configuration validation is performed. The model assumes TTL-honouring caches and a common cutover time for the entered RRsets.',
 'serve-stale, resolver TTL floors, provider replication, SMTP retries and queued mail are not covered. Modeled window ends are not guaranteed propagation times or decommission guidance.',
 'Missing actual lowering time is unverified: only the planned lower-by deadline is supplied.'
]);
export function csvCell(value){let s=value===null||value===undefined?'':String(value);if(/^[\s]*[=+@-]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function toJSON(result){return JSON.stringify(result,null,2);}
export function toCSV(result){const keys=['name','type','oldTTLseconds','newTTLseconds','actualLowered','plannedLowerBy','oldCacheExpiry','shortfallSeconds','modeledWindowEnd','status'];const headers=['version','cutover',...keys,'assumptions'];return [headers,...result.rows.map(r=>[result.version,result.cutover,...keys.map(k=>r[k]),result.assumptions.join(' ')])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function validateField(field,value){
 if(field==='cutover'||field==='actualLowered'){if(field==='actualLowered'&&value==='')return null;return new Date(timestamp(value,field==='cutover'?'Planned cutover':'Actual lowering time')).toISOString();}
 if(field==='name'){
  if(typeof value!=='string'||value.length>254)throw new Error('DNS name: use up to 253 ASCII characters plus an optional final dot.');
  const name=value.replace(/\.$/,'').toLowerCase();
  if(!name||name.length>253||!name.split('.').every(label=>label.length<=63&&/^(?:[a-z0-9_]|[a-z0-9_][a-z0-9_-]*[a-z0-9_])$/.test(label)))throw new Error('DNS name: invalid ASCII labels; use letters, digits, hyphens or underscores, with no edge hyphens.');return name;
 }
 if(field==='type'){if(!['MX','TXT','CNAME'].includes(value))throw new Error('Record type: choose MX, TXT or CNAME.');return value;}
 if(!['string','number'].includes(typeof value)||!/^\d{1,10}$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)>2147483647)throw new Error(`${field==='oldTTLseconds'?'Old TTL':'New TTL'} must be a whole number from 0 to 2147483647 seconds.`);return Number(value);
}
export function calculate(cutover, rows) {
 const c=timestamp(cutover,'Planned cutover'), iso=n=>new Date(n).toISOString();
 if(!Array.isArray(rows)||rows.length<1||rows.length>100)throw new Error('Enter 1 to 100 RRsets.');
 const seen=new Set();
 rows=Array.from(rows).map((r,i)=>{
  const fail=message=>{throw new Error(`Row ${i+1}: ${message}`);};
  if(!r||typeof r!=='object')fail('enter a record.');
  let name,oldTTLseconds,newTTLseconds;
  try{name=validateField('name',r.name);validateField('type',r.type);oldTTLseconds=validateField('oldTTLseconds',r.oldTTLseconds);newTTLseconds=validateField('newTTLseconds',r.newTTLseconds);}catch(e){fail(e.message);}
  const key=name+'|'+r.type;if(seen.has(key))fail('duplicate name and record type.');seen.add(key);
  if(newTTLseconds>oldTTLseconds)fail('new TTL must not exceed old TTL.');
  let actualLowered=null;
  if(r.actualLowered!==''&&r.actualLowered!==null&&r.actualLowered!==undefined){const actual=timestamp(r.actualLowered,`Row ${i+1} lowering time`);if(actual>c)fail('lowering time is after cutover.');actualLowered=iso(actual);}
  return {name,type:r.type,oldTTLseconds,newTTLseconds,actualLowered};
 });
 const output=rows.map(r=>{const old=Number(r.oldTTLseconds), next=Number(r.newTTLseconds), actual=r.actualLowered?Date.parse(r.actualLowered):null; const expiry=actual===null?null:actual+old*1000;const shortfall=expiry===null?null:Math.max(0,(expiry-c)/1000);return {...r,plannedLowerBy:iso(c-old*1000),oldCacheExpiry:expiry===null?null:iso(expiry),modeledWindowEnd:expiry===null?null:iso(Math.max(c+next*1000,expiry)),shortfallSeconds:shortfall,status:expiry===null?'Unverified':shortfall>0?'Lead-time shortfall':'Entered lowering evidence'};});
 return {version:'1.0.0',assumptions:[...ASSUMPTIONS],cutover:iso(c),unverifiedCount:output.filter(r=>r.status==='Unverified').length,shortfallCount:output.filter(r=>r.shortfallSeconds>0).length,rows:output};
}
