import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatDate,formatMoney} from '../lib/finance-data'
import {loadMasterInvoicePage,loadMasterInvoiceBreakdown,loadMasterPaymentPage,
 type MasterInvoice,type MasterInvoiceBreakdown,type MasterPayment} from '../lib/master-billing'
import {checkedSigned} from '../lib/treasury-balances'

export function MasterBilling({client,tenants}:{client:SupabaseClient;tenants:Array<{organization_id:string;organization_name:string}>}){
 const [org,setOrg]=useState(''),[mode,setMode]=useState<'invoices'|'payments'>('invoices')
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [rows,setRows]=useState<{invoices?:MasterInvoice[];payments?:MasterPayment[];hasNext:boolean}|null>(null)
 const [selected,setSelected]=useState<MasterInvoice|null>(null)
 const [breakdown,setBreakdown]=useState<MasterInvoiceBreakdown|null>(null)
 const [error,setError]=useState(''),[breakdownError,setBreakdownError]=useState('')
 useEffect(()=>{
  if(!tenants.some(t=>t.organization_id===org)){
   setOrg('');setRows(null);setSelected(null)
  }
 },[org,tenants])
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setRows(null);setError('');setSelected(null);setBreakdown(null)
  if(org&&tenants.some(t=>t.organization_id===org)){
   const load=mode==='invoices'?loadMasterInvoicePage:loadMasterPaymentPage
   load(client,org,page,controller.signal).then(result=>{
    if(live)setRows(mode==='invoices'?
     {invoices:result.rows as MasterInvoice[],hasNext:result.hasNext}:
     {payments:result.rows as MasterPayment[],hasNext:result.hasNext})
   }).catch(()=>{if(live)setError('Não foi possível conferir o histórico de cobranças SaaS desta Loja.')})
  }
  return()=>{live=false;controller.abort()}
 },[client,org,mode,page,revision,tenants])
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setBreakdown(null);setBreakdownError('')
  if(selected&&org&&tenants.some(t=>t.organization_id===org)){
   loadMasterInvoiceBreakdown(client,org,selected,controller.signal)
    .then(v=>{if(live)setBreakdown(v)})
    .catch(()=>{if(live)setBreakdownError('O detalhamento da fatura não pôde ser conciliado com seu saldo.')})
  }
  return()=>{live=false;controller.abort()}
 },[client,selected,org,tenants])
 function switchMode(next:'invoices'|'payments'){setMode(next);setPage(0)}
 return <section className="panel" aria-label="Cobrança SaaS Master">
  <div className="section-title"><h2>Cobrança SaaS — consulta</h2>
   <button type="button" className="secondary" onClick={()=>{setPage(0);setRevision(v=>v+1)}}>Atualizar cobrança</button>
  </div>
  <p className="subtle">Faturas e pagamentos do serviço SaaS, separados da tesouraria das Lojas. Valores derivam de documentos, ajustes e alocações efetivas do banco, sem registrar pagamentos nesta tela.</p>
  <label htmlFor="master-billing-org">Loja cliente</label>
  <select id="master-billing-org" value={org} onChange={e=>{setOrg(e.target.value);setPage(0)}}>
   <option value="">Selecione a Loja</option>
   {tenants.map(t=><option key={t.organization_id} value={t.organization_id}>{t.organization_name}</option>)}
  </select>
  {!!org&&<div className="finance-sections" role="group" aria-label="Cobrança Master">
   <button className="secondary" aria-pressed={mode==='invoices'} onClick={()=>switchMode('invoices')}>Faturas</button>
   <button className="secondary" aria-pressed={mode==='payments'} onClick={()=>switchMode('payments')}>Pagamentos SaaS</button>
  </div>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {!!org&&!rows&&!error&&<p role="status">Consultando documentos SaaS…</p>}
  {rows&&<>
   {mode==='invoices'&&(!rows.invoices?.length?<p>Nenhuma fatura nesta página.</p>:
    <div className="finance-table" role="region" aria-label="Faturas SaaS" tabIndex={0}>
     <table><thead><tr><th>Documento</th><th>Competência</th><th>Vencimento</th><th>Total atualizado</th><th>Pago</th><th>Em aberto</th><th>Status</th><th>Detalhamento</th></tr></thead>
      <tbody>{rows.invoices?.map(i=><tr key={i.id}>
       <th scope="row">{i.invoice_number}</th><td>{i.competence.slice(0,7)}</td>
       <td>{formatDate(i.due_date)}</td><td>{formatMoney(checkedSigned(i.amount_due))}</td>
       <td>{formatMoney(checkedSigned(i.amount_paid))}</td>
       <td>{formatMoney(checkedSigned(i.amount_open))}</td><td>{i.derived_status}</td>
       <td><button type="button" className="secondary" onClick={()=>setSelected(i)}>Ver composição</button></td>
      </tr>)}</tbody>
     </table>
    </div>)}
   {mode==='payments'&&(!rows.payments?.length?<p>Nenhum pagamento SaaS nesta página.</p>:
    <div className="finance-table" role="region" aria-label="Pagamentos comerciais SaaS" tabIndex={0}>
     <table><thead><tr><th>Pagamento</th><th>Data</th><th>Recebido</th><th>Alocado</th><th>Crédito não alocado</th><th>Situação</th></tr></thead>
      <tbody>{rows.payments?.map(p=><tr key={p.id}>
       <th scope="row">{p.id.slice(0,8)}</th><td>{new Date(p.paid_at).toLocaleDateString('pt-BR')}</td>
       <td>{formatMoney(checkedSigned(p.amount))}</td>
       <td>{formatMoney(checkedSigned(p.allocated_amount))}</td>
       <td>{formatMoney(checkedSigned(p.unallocated_amount))}</td>
       <td>{p.active?'Ativo':'Revertido'}</td>
      </tr>)}</tbody>
     </table>
    </div>)}
   <div className="finance-pagination">
    <button className="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Anterior</button>
    <span role="status">Página {page+1}</span>
    <button className="secondary" disabled={!rows.hasNext} onClick={()=>setPage(v=>v+1)}>Próxima</button>
   </div>
   {selected&&mode==='invoices'&&<section className="panel" aria-label="Composição da fatura">
    <h3>Composição — {selected.invoice_number}</h3>
    {breakdownError&&<p role="alert" className="message error">{breakdownError}</p>}
    {!breakdown&&!breakdownError&&<p role="status">Conciliando composição do documento…</p>}
    {breakdown&&<table><tbody>
     <tr><th>Base contratual</th><td>{formatMoney(checkedSigned(breakdown.base_amount))}</td></tr>
     <tr><th>Multa</th><td>{formatMoney(checkedSigned(breakdown.late_fee_amount))}</td></tr>
     <tr><th>Juros</th><td>{formatMoney(checkedSigned(breakdown.interest_amount))}</td></tr>
     <tr><th>Descontos e créditos</th><td>{formatMoney(checkedSigned(breakdown.discount_credit_amount))}</td></tr>
     <tr><th>Outros ajustes</th><td>{formatMoney(checkedSigned(breakdown.other_increase_amount))}</td></tr>
     <tr><th>Total atualizado</th><td>{formatMoney(checkedSigned(breakdown.updated_total))}</td></tr>
    </tbody></table>}
   </section>}
  </>}
  <p className="subtle">Paginação de 25 documentos. Emissão, recebimentos, reversões, acordos e notificações comerciais ainda exigem fluxos de autorização e auditoria próprios.</p>
 </section>
}
