import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDate,formatMoney } from '../lib/finance-data'
import {
 loadTreasuryAccounts,loadTreasuryMovements,checkedSigned,
 type TreasuryAccount,type TreasuryMovement,
} from '../lib/treasury-balances'
type BalanceAccount=TreasuryAccount&{balance:number|null}
export function TreasuryBalances({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [accounts,setAccounts]=useState<BalanceAccount[]|null>(null)
 const [selected,setSelected]=useState('')
 const [page,setPage]=useState(0)
 const [revision,setRevision]=useState(0)
 const [movements,setMovements]=useState<{rows:TreasuryMovement[];hasNext:boolean}|null>(null)
 const [error,setError]=useState(''),[movementError,setMovementError]=useState('')
 useEffect(()=>{
  let live=true;const abort=new AbortController()
  setAccounts(null);setError('');setSelected('')
  loadTreasuryAccounts(client,organizationId,abort.signal)
    .then(rows=>{if(live){setAccounts(rows);setSelected(rows[0]?.id??'')}})
    .catch(()=>{if(live)setError('Não foi possível consultar os saldos de caixa e banco com segurança.')})
  return()=>{live=false;abort.abort()}
 },[client,organizationId,revision])
 useEffect(()=>{
  let live=true;const abort=new AbortController()
  setMovements(null);setMovementError('')
  if(selected&&accounts?.some(a=>a.id===selected)){
   loadTreasuryMovements(client,organizationId,selected,page,abort.signal)
    .then(data=>{if(live)setMovements(data)})
    .catch(()=>{if(live)setMovementError('A consulta de movimentações falhou. Os saldos não foram alterados.')})
  }
  return()=>{live=false;abort.abort()}
 },[client,organizationId,selected,page,accounts])
 return <section className="panel" aria-label="Caixa e bancos">
  <div className="section-title"><h2>Caixa, bancos e movimentações</h2>
   <button className="secondary" type="button" onClick={()=>{setPage(0);setRevision(v=>v+1)}}>Atualizar saldos</button>
  </div>
  <p className="subtle">Saldo derivado das movimentações efetivamente contabilizadas na conta; não equivale a saldo bancário conciliado e não soma previsões de cobrança ou obrigações ainda não liquidadas.</p>
  {error&&<p role="alert" className="message error">{error}</p>}
  {!accounts?(!error&&<p role="status">Carregando contas financeiras…</p>):<>
   {!accounts.length?<p>Nenhuma conta de caixa/banco cadastrada.</p>:<>
    <div className="finance-table" role="region" tabIndex={0} aria-label="Saldos das contas financeiras">
     <table><thead><tr><th>Conta</th><th>Tipo</th><th>Situação</th><th>Saldo derivado</th></tr></thead>
      <tbody>{accounts.map(a=><tr key={a.id}>
       <th scope="row">{a.name}</th><td>{a.account_type}</td><td>{a.active?'Ativa':'Inativa'}</td>
       <td>{a.balance===null?'Sem movimentos registrados':formatMoney(a.balance)}</td>
      </tr>)}</tbody>
     </table>
    </div>
    <label htmlFor="treasury-account">Conta para consultar movimentações</label>
    <select id="treasury-account" value={selected} onChange={e=>{setPage(0);setSelected(e.target.value)}}>
     {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
    {movementError&&<p role="alert" className="message error">{movementError}</p>}
    {selected&&!movements&&!movementError&&<p role="status">Consultando movimentações da conta…</p>}
    {movements&&<>
     {!movements.rows.length?<p>Nenhum movimento nesta página.</p>:
      <div className="finance-table" role="region" aria-label="Movimentações financeiras" tabIndex={0}>
       <table><thead><tr><th>Data</th><th>Tipo do evento</th><th>Valor assinado</th><th>Referência</th></tr></thead>
        <tbody>{movements.rows.map((m,index)=><tr key={`${m.source_id}:${m.movement_type}:${index}`}>
         <td>{formatDate(m.movement_date)}</td><td>{m.movement_type}</td>
         <td>{formatMoney(checkedSigned(m.signed_amount))}</td><td>{m.source_id.slice(0,8)}</td>
        </tr>)}</tbody>
       </table>
      </div>}
     <div className="finance-pagination">
      <button className="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Anterior</button>
      <span role="status">Página {page+1} — {movements.rows.length} movimentos</span>
      <button className="secondary" disabled={!movements.hasNext} onClick={()=>setPage(v=>v+1)}>Próxima</button>
     </div>
    </>}
   </>}
   <p className="subtle">As movimentações são paginadas. Valores desta página não devem ser somados como saldo global. Conciliação bancária OFX/CSV e transferências são funcionalidades distintas.</p>
  </>}
 </section>
}
