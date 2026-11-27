const GUID=/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const HEADER=['AppId','Kind','CredentialId','StartUtc','EndUtc'];
const fail=message=>{throw new Error(message);};
function utc(value){
 if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(value))fail('Use exact minute UTC timestamps YYYY-MM-DDTHH:mmZ, years 2000–2099.');
 const ms=Date.parse(value);if(!Number.isFinite(ms)||new Date(ms).toISOString().replace(':00.000Z','Z')!==value)fail('Use valid calendar dates and times in minute UTC format.');return ms;
}
function csvRows(text){
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c===','||c==='\n'||c==='\r'){
   row.push(cell);cell='';closed=false;
   if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;rows.push(row);row=[];}continue;
  }
  if(closed)fail('Invalid CSV quoting. Use the five-column CSV format.');
  if(c==='"'){if(cell)fail('Invalid CSV quoting. Use the five-column CSV format.');quoted=true;}else cell+=c;
 }
 if(quoted)fail('Invalid CSV quoting. Use the five-column CSV format.');
 if(cell||closed||row.length){row.push(cell);rows.push(row);}return rows;
}
export function reviewCoverage(text,startUtc,endUtc){
 const start=utc(startUtc),end=utc(endUtc),minutes=(end-start)/60000;
 if(minutes<=0||minutes>527040)fail('Horizon start must precede end, with a maximum of 366 elapsed days.');
 const metadata=parseMetadata(text).sort((a,b)=>[a.appId,a.kind,a.credentialId].join('/').localeCompare([b.appId,b.kind,b.credentialId].join('/')));
 const grouped=new Map();
 const format=ms=>new Date(ms).toISOString().replace(':00.000Z','Z');
 for(const credential of metadata){
  const key=credential.appId+'/'+credential.kind;
  if(!grouped.has(key))grouped.set(key,{appId:credential.appId,kind:credential.kind,evidence:[],windows:[],gapMinutes:0,overlapMinutes:0,coveredMinutes:0});
  const a=Math.max(start,utc(credential.startUtc)),b=Math.min(end,utc(credential.endUtc));
  grouped.get(key).evidence.push({...credential,relation:a>=b?'outside':a===utc(credential.startUtc)&&b===utc(credential.endUtc)?'within':'clipped',clippedStartUtc:a<b?format(a):null,clippedEndUtc:a<b?format(b):null});
 }
 for(const group of grouped.values()){
  // Parse clipped boundaries once; bounded metadata can still produce many windows.
  const inside=group.evidence.filter(c=>c.relation!=='outside').map(c=>({credentialId:c.credentialId,a:utc(c.clippedStartUtc),b:utc(c.clippedEndUtc)}));
  const points=[...new Set([start,end,...inside.flatMap(c=>[c.a,c.b])])].sort((a,b)=>a-b);
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1],credentialIds=inside.filter(c=>c.a<=a&&c.b>a).map(c=>c.credentialId);
   const type=credentialIds.length===0?'gap':credentialIds.length===1?'single':'overlap',duration=(b-a)/60000;
   group.windows.push({type,startUtc:format(a),endUtc:format(b),minutes:duration,credentialIds});
   if(type==='gap')group.gapMinutes+=duration;else group.coveredMinutes+=duration;
   if(type==='overlap')group.overlapMinutes+=duration;
  }
 }
 return {horizon:{startUtc,endUtc,minutes},metadata,groups:[...grouped.values()]};
}
export const LIMITS='Metadata validity only, for supplied application/kind groups. Not proof of usable credentials, actual authentication, application rollout, interchangeability, revocation or outage. No live checks. Missing credentials and applications are not inferred.';
export function toJSON(report){return JSON.stringify({tool:'Entra Credential Coverage',version:'1.0.0',limits:LIMITS,...report},null,2);}
export function toCSV(report){
 const columns=['RecordType','AppId','Kind','CredentialId','StartUtc','EndUtc','Minutes','Count','CredentialIds','Relation','ClippedStartUtc','ClippedEndUtc','HorizonStartUtc','HorizonEndUtc','GapMinutes','CoveredMinutes','OverlapMinutes','Note'];
 const rows=[columns];
 const add=record=>{const complete={...record,HorizonStartUtc:report.horizon.startUtc,HorizonEndUtc:report.horizon.endUtc,Note:LIMITS};rows.push(columns.map(key=>complete[key]??''));};
 for(const g of report.groups){
  add({RecordType:'group',AppId:g.appId,Kind:g.kind,Minutes:report.horizon.minutes,Count:g.evidence.length,GapMinutes:g.gapMinutes,CoveredMinutes:g.coveredMinutes,OverlapMinutes:g.overlapMinutes});
  for(const w of g.windows)add({RecordType:'window',AppId:g.appId,Kind:g.kind,StartUtc:w.startUtc,EndUtc:w.endUtc,Minutes:w.minutes,Count:w.credentialIds.length,CredentialIds:w.credentialIds.join(';'),Relation:w.type});
  for(const e of g.evidence)add({RecordType:'evidence',AppId:g.appId,Kind:g.kind,CredentialId:e.credentialId,StartUtc:e.startUtc,EndUtc:e.endUtc,Relation:e.relation,ClippedStartUtc:e.clippedStartUtc,ClippedEndUtc:e.clippedEndUtc});
 }
 return rows.map(row=>row.map(value=>{let s=String(value);if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
}
export function parseMetadata(text){
 if(typeof text!=='string')fail('Supply CSV text containing credential metadata.');
 if(new TextEncoder().encode(text).length>1048576)fail('CSV must not exceed 1 MiB UTF-8.');
 const rows=csvRows(text.replace(/^\ufeff/,''));
 if(!rows.length||rows[0].length!==5||rows[0].some((v,i)=>v!==HEADER[i]))fail('Use exactly AppId,Kind,CredentialId,StartUtc,EndUtc in that order. No additional fields.');
 if(rows.length<2)fail('Add at least one credential metadata row; empty evidence cannot be reviewed.');
 if(rows.length>1001)fail('Supply at most 1000 credential metadata rows.');
 const seen=new Set();
 return rows.slice(1).map((fields,i)=>{
  const [appId,kind,credentialId,startUtc,endUtc]=fields;
  if(fields.length!==5||!GUID.test(appId)||!GUID.test(credentialId)||!['secret','certificate'].includes(kind))fail(`Row ${i+2}: use exact GUIDs, kind secret or certificate, and five fields only.`);
  if(utc(startUtc)>=utc(endUtc))fail(`Row ${i+2}: credential start must be before end.`);
  const key=[appId.toLowerCase(),kind,credentialId.toLowerCase()].join('/');
  if(seen.has(key))fail(`Row ${i+2}: duplicate credential ID within the same application and kind. Remove the duplicate or reconcile the metadata.`);seen.add(key);
  return {appId:appId.toLowerCase(),kind,credentialId:credentialId.toLowerCase(),startUtc,endUtc};
 });
}
