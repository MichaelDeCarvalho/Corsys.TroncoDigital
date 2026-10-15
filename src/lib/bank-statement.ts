export type StatementLine={date:string;description:string;amount:string;external_id:string|null}
export type StatementPreview={lines:StatementLine[];start:string;end:string}
const invalid=()=>new Error('Extrato inválido. Use OFX BRL ou CSV data;descricao;valor;id, com até 500 linhas e valores em reais com ponto decimal.')
function validDate(value:string){
 const d=new Date(value+'T12:00:00Z')
 return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&value>='2020-01-01'
}
function line(date:string,description:string,amount:string,id:string|null):StatementLine{
 if(!validDate(date)||!description.trim()||description.length>500||
  !/^-?\d{1,12}(\.\d{1,2})?$/.test(amount)||Number(amount)===0||
  !Number.isFinite(Number(amount))||Math.abs(Number(amount))>999999999999.99||
  (id!==null&&(!id.trim()||id.length>200)))throw invalid()
 return {date,description:description.trim(),amount:Number(amount).toFixed(2),external_id:id?.trim()??null}
}
// CSV quoted fields are supported; malformed quoting fails closed.
function csv(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else field+=c;continue}
  if(c==='"'){if(field||closed)throw invalid();quoted=true;continue}
  if(c===';'||c==='\n'){row.push(field);field='';closed=false;if(c==='\n'){rows.push(row);row=[]}continue}
  if(closed)throw invalid()
  field+=c
 }
 if(quoted)throw invalid()
 if(field||row.length){row.push(field);rows.push(row)}
 return rows
}
export function parseBankStatement(text:string,filename:string):StatementPreview{
 if(!text||new TextEncoder().encode(text).length>1_000_000||/\u0000/.test(text))throw invalid()
 text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim()
 let lines:StatementLine[]
 if(/\.csv$/i.test(filename)){
  const rows=csv(text)
  if(rows.shift()?.join(';')!=='data;descricao;valor;id')throw invalid()
  lines=rows.map(r=>{if(r.length!==4)throw invalid();return line(r[0],r[1],r[2],r[3]||null)})
 }else if(/\.ofx$/i.test(filename)){
  if(/<!DOCTYPE|<!ENTITY|&/i.test(text)||!/<CURDEF>\s*BRL\s*(?:<|$)/i.test(text)||
   (text.match(/<BANKTRANLIST>/gi)??[]).length!==1)throw invalid()
  const chunks=[...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)]
  if(chunks.length!==(text.match(/<STMTTRN>/gi)??[]).length)throw invalid()
  lines=chunks.map(m=>{
   const tag=(name:string,required=true)=>{
    const values=[...m[1].matchAll(new RegExp('<'+name+'>\\s*([^<\\n]*)','gi'))]
    if(values.length>1||required&&values.length!==1)throw invalid()
    return values[0]?.[1].trim()??''
   }
   const date=tag('DTPOSTED')
   if(!/^\d{8}(?:\d{6}(?:\.\d+)?(?:\[[^\]]+\])?)?$/.test(date))throw invalid()
   return line(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8),tag('MEMO',false)||tag('NAME'),tag('TRNAMT'),tag('FITID'))
  })
 }else throw invalid()
 if(!lines.length||lines.length>500)throw invalid()
 const ids=new Set<string>()
 for(const l of lines){if(l.external_id){if(ids.has(l.external_id))throw invalid();ids.add(l.external_id)}}
 const dates=lines.map(l=>l.date).sort()
 return {lines,start:dates[0],end:dates[dates.length-1]}
}
