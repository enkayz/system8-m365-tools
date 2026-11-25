export function exportJSON(result){return JSON.stringify(result,null,2);}
function csvCell(value){let s=String(value);if(/^[=+@\-\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function exportCSV(result){
 const header=['Address','RequestedRecipientId','ExistingOwners','RequestingOwners','StatusFlags','CurrentDuplicatePairs','RequestedDuplicatePairs','ReviewNotice'];
 const rows=result.rows.map(row=>[row.address,row.recipientId,result.addresses[row.address].existingOwners.join('; '),result.addresses[row.address].requestingOwners.join('; '),row.flags.join('; '),result.current.duplicateCount,result.requested.duplicateCount,result.notice]);
 return [header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
export const REVIEW_NOTICE='Review only. Missing addresses are not proof of tenant uniqueness or live availability. Evidence may omit deleted, hidden, hybrid, mail-enabled public folder (MEPF), Entra-only or unexported recipients, and may be stale or incomplete. No assessment of primary SMTP, accepted domains, policies, deliverability or transfer ordering. Whole SMTP addresses and GUIDs are lowercased for comparison; duplicate pairs count once. Same-owner duplicates are not competing requests.';
export function reviewClaims(currentText,requestedText,confirmed) {
 if(confirmed!==true)throw new Error('Confirm the same tenant and stable RecipientId GUID scheme across both lists.');
 const current=parseEvidence(currentText),requested=parseEvidence(requestedText);
 const existing=new Map(),requesting=new Map();
 for(const [data,map] of [[current,existing],[requested,requesting]])for(const row of data.rows){if(!map.has(row.address))map.set(row.address,new Set());map.get(row.address).add(row.recipientId);}
 const addresses={};let references=0;
 for(const [address,owners] of requesting){
  const existingOwners=[...(existing.get(address)||[])].sort(),requestingOwners=[...owners].sort();
  references+=owners.size*(existingOwners.length+requestingOwners.length);
  if(references>50000)throw new Error('Review exceeds 50000 related owner references. Split requests into smaller batches, retaining relevant current evidence and all competing requests for each address.');
  addresses[address]={existingOwners,requestingOwners};
 }
 const rows=requested.rows.map(({address,recipientId})=>{
  const {existingOwners,requestingOwners}=addresses[address],flags=[];
  if(existingOwners.some(id=>id!==recipientId))flags.push('current-other-owner conflict');
  if(requestingOwners.length>1)flags.push('multiple-request-owner conflict');
  if(existingOwners.includes(recipientId))flags.push('current-same-owner');
  if(!existingOwners.length)flags.push('not seen in supplied current list');
  return {address,recipientId,flags};
 });
 return {tool:'Exchange Alias Claim Review',version:'1.0.0',sameTenantAndIdSchemeConfirmed:true,notice:REVIEW_NOTICE,current,requested,addresses,rows,ownerReferences:references};
}
export const LIMITS=Object.freeze({bytes:1048576,rows:5000,ownerReferences:50000});
export function decodeEvidence(bytes) {
 if(bytes.byteLength>LIMITS.bytes) throw new Error('Input exceeds 1 MiB. Reduce the evidence file.');
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('File must be valid UTF-8. Re-export it as UTF-8 CSV.');}
}
function csvRecords(text) {
 // A strict two-column CSV dialect: quoted cells and escaped quotes are accepted;
 // embedded line breaks and controls are not part of either supported field.
 const lines=text.replace(/^\ufeff/,'').split(/\r\n|\n/);
 if(lines.at(-1)==='') lines.pop();
 return lines.map((line,index)=>{
  if(!line || /[\x00-\x1f\x7f]/.test(line)) throw new Error(`CSV row ${index+1}: blank rows and controls are not supported.`);
  const cells=[];let pos=0;
  while(pos<=line.length){
   let value='';
   if(line[pos]==='"'){
    pos++;let closed=false;
    while(pos<line.length){if(line[pos]==='"'){if(line[pos+1]==='"'){value+='"';pos+=2;}else{pos++;closed=true;break;}}else value+=line[pos++];}
    if(!closed || (pos<line.length && line[pos]!==',')) throw new Error(`CSV row ${index+1}: malformed quoted cell.`);
   }else{while(pos<line.length && line[pos]!==','){if(line[pos]==='"') throw new Error(`CSV row ${index+1}: unexpected quote.`);value+=line[pos++];}}
   cells.push(value);if(pos===line.length) break;pos++;if(pos===line.length){cells.push('');break;}
  }
  if(cells.length!==2) throw new Error(`CSV row ${index+1}: expected exactly two columns.`);
  return cells;
 });
}
function validAddress(address){
 if(address.length>254 || address!==address.trim() || /[^\x21-\x7e]/.test(address))return false;
 const parts=address.split('@');if(parts.length!==2)return false;
 const [local,domain]=parts;
 if(!local || local.length>64 || !/^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*$/.test(local))return false;
 const labels=domain.split('.');
 return labels.length>=2 && labels.every(label=>label.length<=63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}
export function parseEvidence(text) {
 if(typeof text!=='string' || new TextEncoder().encode(text).length>LIMITS.bytes) throw new Error('Each input must be UTF-8 CSV, no more than 1 MiB.');
 const records=csvRecords(text);
 if(!records.length || records[0][0]!=='RecipientId' || records[0][1]!=='Address') throw new Error('CSV headers must be exactly RecipientId,Address in that order.');
 if(records.length<2 || records.length-1>LIMITS.rows) throw new Error('Each input needs 1–5000 data rows.');
 const unique=new Map();let duplicateCount=0;
 records.slice(1).forEach(([id,address],index)=>{
  if(!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id))throw new Error(`CSV row ${index+2}: RecipientId must be an exact GUID without spaces.`);
  if(!validAddress(address))throw new Error(`CSV row ${index+2}: use a bare ASCII dot-atom SMTP address without spaces or prefixes.`);
  const row={recipientId:id.toLowerCase(),address:address.toLowerCase()},key=row.recipientId+'|'+row.address;
  if(unique.has(key))duplicateCount++;else unique.set(key,row);
 });
 return {rows:[...unique.values()],rowCount:records.length-1,duplicateCount};
}
