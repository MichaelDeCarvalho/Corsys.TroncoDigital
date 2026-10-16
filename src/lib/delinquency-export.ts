import type {SupabaseClient} from '@supabase/supabase-js'
import {loadDelinquencyPage,DELINQUENCY_PAGE,type DelinquencyRow} from './delinquency-report'
import {checkedSigned} from './treasury-balances'

export const MAX_DELINQUENCY_EXPORT=1000

export async function loadDelinquencyExport(client:SupabaseClient,org:string,isActive:()=>boolean=()=>true){
 const result:DelinquencyRow[]=[]
 const members=new Set<string>()
 const pages=Math.ceil(MAX_DELINQUENCY_EXPORT/DELINQUENCY_PAGE)+1
 for(let page=0;page<pages;page++){
  if(!isActive())throw Error('Exportação cancelada porque a Loja mudou.')
  const response=await loadDelinquencyPage(client,org,page)
  if(!isActive())throw Error('Exportação cancelada porque a Loja mudou.')
  for(const row of response.rows){
   if(members.has(row.member_id))throw Error('Exportação interrompida: posição duplicada entre páginas.')
   members.add(row.member_id)
   result.push(row)
  }
  if(result.length>MAX_DELINQUENCY_EXPORT)throw Error('Exportação excede 1.000 integrantes; limite de segurança atingido.')
  if(!response.hasNext)return result
 }
 throw Error('Exportação não pôde completar todas as páginas dentro do limite.')
}

const textCell=(value:string)=>{
 // Neutralize spreadsheet formula injection (including whitespace/control prefixes).
 const compact=value.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim()
 const normalized=compact.normalize('NFKC')
 const safe=/^[=+\-@]/.test(normalized)?"'"+compact:compact
 return '"'+safe.replace(/"/g,'""')+'"'
}
const numericCell=(value:number)=>'"'+value.toFixed(2).replace('.',',')+'"'

export function createDelinquencyCsv(rows:DelinquencyRow[]){
 const header=['Integrante','Situação','Primeiro vencimento','Cobranças vencidas','Saldo vencido (BRL)','Crédito sem alocação (BRL)','Posição líquida geral (BRL)'].map(textCell).join(';')
 const body=rows.map(row=>{
  const overdue=checkedSigned(row.overdue_amount)
  const credit=checkedSigned(row.available_credit)
  const net=checkedSigned(row.net_position)
  if(overdue<=0||credit<0||!Number.isSafeInteger(row.overdue_items)||row.overdue_items<1)
   throw Error('Valor financeiro de inadimplência inválido.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.oldest_due))throw Error('Data de vencimento inválida.')
  return [
   textCell(row.full_name),textCell(row.member_status),
   textCell(row.oldest_due.slice(8,10)+'/'+row.oldest_due.slice(5,7)+'/'+row.oldest_due.slice(0,4)),
   String(row.overdue_items),numericCell(overdue),numericCell(credit),numericCell(net),
  ].join(';')
 })
 return '\uFEFF'+[header,...body].join('\r\n')+'\r\n'
}
