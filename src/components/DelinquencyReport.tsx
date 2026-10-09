import { useEffect,useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDate,formatMoney } from '../lib/finance-data'
import { loadDelinquencyPage,type DelinquencyRow } from '../lib/delinquency-report'
export function DelinquencyReport({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [result,setResult]=useState<{rows:DelinquencyRow[];hasNext:boolean}|null>(null)
 const [error,setError]=useState(''),[denied,setDenied]=useState(false)
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
 return <section className="panel" aria-label="Relatório de inadimplência">
  <div className="section-title"><h2>Inadimplência por integrante</h2>
   <button className="secondary" type="button" onClick={()=>{setPage(0);setRevision(v=>v+1)}}>Atualizar posições</button>
  </div>
  <p className="subtle">Somente cobranças vencidas com saldo positivo, segundo a data do banco. Créditos de pagamentos ainda não alocados aparecem separadamente e não quitam automaticamente cobranças. A posição líquida considera também obrigações a vencer.</p>
  {denied&&<p className="subtle">Seu perfil não possui permissão para consultar a inadimplência da Loja.</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
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
   <p className="subtle">Dados paginados por integrante. Não some esta página como inadimplência total da Loja; o Painel financeiro fornece o consolidado.</p>
  </>}
 </section>
}
