export const LIMIT=400;
export const toJSON=packet=>JSON.stringify(packet,null,2);
export function toCSV(packet){
 const headers=['line','relative_file_path','root_a','root_b','a_length','a_headroom','a_reduction','b_length','b_headroom','b_reduction','resolved_by_b','duplicate_lines','case_lines','prefix_lines','unicode_review','needs_review'];
 const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 return [headers,...packet.rows.map(r=>[r.line,r.path,packet.rootA,packet.rootB,r.a.length,r.a.headroom,r.a.reduction,r.b?.length,r.b?.headroom,r.b?.reduction,r.resolvedByB,r.duplicateLines.join(';'),r.caseLines.join(';'),r.prefixLines.join(';'),r.unicodeReview,r.needsReview])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
const budget=(root,path)=>{const length=root.length+1+path.length;return {length,headroom:LIMIT-length,reduction:Math.max(0,length-LIMIT)};};
export const MAX_BYTES=1048576,MAX_ROWS=5000;
function validPath(value,label,isRoot=false){
 if(isRoot&&typeof value==='string'&&value.length>4096)throw new Error(`${label}: maximum 4,096 UTF-16 code units. Use a shorter destination prefix.`);
 if(typeof value!=='string'||!value||value!==value.trim()||/[\\\\\u0000-\u001f\u007f-\u009f]/u.test(value)||/^[A-Za-z]:/.test(value)||(isRoot&&/[:?#]/.test(value))||value.split('/').some(s=>!s||s==='.'||s==='..')) throw new Error(`${label}: use a literal slash-separated path; no URL, outer whitespace, controls, backslashes, empty or dot segments.`);
}
export function parseList(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES) throw new Error('File list exceeds 1 MiB.');
 const lines=text.split(/\r?\n/);if(lines.length>MAX_ROWS+1||(lines.length===MAX_ROWS+1&&lines.at(-1)!==''))throw new Error('File list exceeds 5,000 physical lines.');
 const rows=[];let ignoredBlankLines=0;
 lines.forEach((path,i)=>{if(path===''){ignoredBlankLines++;return;}validPath(path,`Line ${i+1}`);rows.push({line:i+1,path});});
 if(!rows.length)throw new Error('Enter at least one relative file path.');
 return {rows,ignoredBlankLines};
}
export function compare(rootA,rootB,text){
 validPath(rootA,'Destination prefix A',true);if(rootB!=='')validPath(rootB,'Destination prefix B',true);
 const parsed=parseList(text);
 const rows=parsed.rows.map(({path,line})=>{const a=budget(rootA,path),b=rootB?budget(rootB,path):null;return {line,path,a,b,resolvedByB:!!b&&a.reduction>0&&b.reduction===0,duplicateLines:[],caseLines:[],prefixLines:[],unicodeReview:/[^\x00-\x7f]/u.test(rootA+rootB+path)};});
 const fold=s=>s.replace(/[A-Z]/g,c=>c.toLowerCase());
 const groups=new Map(),trie={children:new Map(),rows:[]};
 for(const row of rows){const key=fold(row.path);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);let node=trie;for(const part of key.split('/')){if(!node.children.has(part))node.children.set(part,{children:new Map(),rows:[]});node=node.children.get(part);}node.rows.push(row);}
 let references=0;
 function relate(list,line){if(++references>50000)throw new Error('List exceeds 50,000 related-line references. Reduce repeated/conflicting entries and recheck the combined list; splitting alone can hide cross-batch conflicts. No partial report was created.');list.push(line);}
 for(const row of rows){
  for(const other of groups.get(fold(row.path)))if(other!==row)relate(other.path===row.path?row.duplicateLines:row.caseLines,other.line);
  const parts=fold(row.path).split('/');let node=trie;for(let i=0;i<parts.length-1;i++){node=node.children.get(parts[i]);for(const parent of node.rows){relate(row.prefixLines,parent.line);relate(parent.prefixLines,row.line);}}
 }
 for(const row of rows){row.prefixLines.sort((a,b)=>a-b);row.needsReview=!!(row.a.reduction||row.b?.reduction||row.duplicateLines.length||row.caseLines.length||row.prefixLines.length||row.unicodeReview);}
 const counts={total:rows.length,overA:rows.filter(r=>r.a.reduction).length,overB:rootB?rows.filter(r=>r.b.reduction).length:null,resolvedByB:rows.filter(r=>r.resolvedByB).length,review:rows.filter(r=>r.needsReview).length};
 return {schemaVersion:1,toolVersion:'1.0.0',limit:LIMIT,countConvention:'UTF-16 code units; literal decoded server-relative paths without leading slash',scope:'Path budget and listed conflicts only; not migration readiness',rootA,rootB:rootB||null,ignoredBlankLines:parsed.ignoredBlankLines,counts,rows};
}
