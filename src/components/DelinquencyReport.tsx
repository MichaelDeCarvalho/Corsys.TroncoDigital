import { useEffect,useRef,useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDate,formatMoney } from '../lib/finance-data'
import { loadDelinquencyPage,type DelinquencyRow } from '../lib/delinquency-report'
import { createDelinquencyCsv,loadDelinquencyExport } from '../lib/delinquency-export'
export function DelinquencyReport({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [result,setResult]=useState<{rows:DelinquencyRow[];hasNext:boolean}|null>(null)
 const [error,setError]=useState(''),[denied,setDenied]=useState(false)
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('')
 const stillMounted=useRef(true),currentTenant=useRef(organizationId),exportGuard=useRef(false)
 currentTenant.current=organizationId
 useEffect(()=>{stillMounted.current=true;return()=>{stillMounted.current=false}},[])
 useEffect(()=>{
  let live=true;setResult(null);setError('');setDenied(false)
  loadDelinquencyPage(client,organizationId,page).then(data=>{
   if(live)setResult(data)
  }).catch(cause=>{
   if(!live)return
   const code=(cause as {code?:string}|null)?.code
   if(code==='42501'||code==='28000')setDenied(true)
   else setError('O relatório de inadimplência não pôde ser validado; nenhum valor parcial é apresentado.')
  })
  return()=>{live=false}
 },[client,organizationId,page,revision])
 async function exportCsv(){
  if(exportGuard.current||!result||denied||error)return
  exportGuard.current=true;setExporting(true);setExportError('')
  const org=organizationId
  const safe=()=>stillMounted.current&&currentTenant.current===org
  try{
   const rows=await loadDelinquencyExport(client,org,safe)
   if(!safe())return
   const contents=createDelinquencyCsv(rows)
   if(!safe())return
   const blob=new Blob([contents],{type:'text/csv;charset=utf-8'})
   const url=URL.createObjectURL(blob)
   try{
    const anchor=document.createElement('a')
    anchor.href=url
    anchor.download='inadimplencia-'+org.slice(0,8)+'.csv'
    anchor.style.display='none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
   }finally{URL.revokeObjectURL(url)}
  }catch{
   if(safe())setExportError('A exportação não pôde ser concluída ou excedeu 1.000 registros; nenhum arquivo parcial foi disponibilizado.')
  }finally{
   exportGuard.current=false
   if(safe())setExporting(false)
  }
 }
 return <section className="panel" aria-label="Relatório de inadimplência">
  <div className="section-title"><h2>Inadimplência por integrante</h2>
   <button className="secondary" type="button" onClick={()=>{setPage(0);setRevision(v=>v+1)}}>Atualizar posições</button>
   <button className="secondary" type="button" disabled={!result||denied||exporting}
    onClick={()=>{void exportCsv()}}>{exporting?'Preparando CSV…':'Exportar CSV completo'}</button>
  </div>
  <p className="subtle">Somente cobranças vencidas com saldo positivo, segundo a data do banco. Créditos de pagamentos ainda não alocados aparecem separadamente e não quitam automaticamente cobranças. A posição líquida considera também obrigações a vencer.</p>
  {denied&&<p className="subtle">Seu perfil não possui permissão para consultar a inadimplência da Loja.</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {exportError&&<p role="alert" className="message error">{exportError}</p>}
  {!result&&!error&&!denied&&<p role="status">Consultando posições vencidas…</p>}
  {result&&<>
   {!result.rows.length?<p>Nenhum integrante com cobrança vencida nesta página.</p>:
   <div className="finance-table" role="region" tabIndex={0} aria-label="Inadimplência consultada">
    <table><thead><tr><th>Integrante</th><th>Primeiro vencimento</th><th>Cobranças vencidas</th><th>Saldo vencido</th><th>Crédito sem alocação</th><th>Posição líquida geral</th></tr></thead>
     <tbody>{result.rows.map(m=><tr key={m.member_id}>
      <th scope="row">{m.full_name}</th><td>{formatDate(m.oldest_due)}</td>
      <td>{m.overdue_items}</td><td>{formatMoney(Number(m.overdue_amount))}</td>
      <td>{formatMoney(Number(m.available_credit))}</td>
      <td>{formatMoney(Number(m.net_position))}</td>
     </tr>)}</tbody>
    </table>
   </div>}
   <div className="finance-pagination">
    <button className="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Anterior</button>
    <span role="status">Página {page+1} — {result.rows.length} integrantes</span>
    <button className="secondary" disabled={!result.hasNext} onClick={()=>setPage(v=>v+1)}>Próxima</button>
   </div>
   <p className="subtle">Dados paginados por integrante. Não some esta página como inadimplência total da Loja; o Painel financeiro fornece o consolidado. A exportação consulta todas as páginas até 1.000 integrantes, sem salvar informações no servidor; se a lista mudar durante a consulta, o CSV pode não representar uma fotografia transacional. CSV compatível com Excel não é arquivo XLSX nem PDF.</p>
  </>}
 </section>
}
