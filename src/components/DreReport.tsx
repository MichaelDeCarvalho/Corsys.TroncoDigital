import { useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatMoney } from '../lib/finance-data'
import { loadDreReport, summarizeDre, safeDreValue, type DreEntry } from '../lib/dre-report'

const natureLabels:Record<string,string>={
 revenue:'Receita',cost:'Custo',expense:'Despesa',financial_result:'Resultado financeiro',
}
export function DreReport({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [rows,setRows]=useState<DreEntry[]|null>(null)
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 const [range,setRange]=useState('')
 const seq=useRef(0)
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(loading)return
  const values=new FormData(e.currentTarget)
  const from=String(values.get('from')??''),to=String(values.get('to')??'')
  const current=++seq.current
  setError('');setRows(null);setLoading(true);setRange('')
  try{
   const result=await loadDreReport(client,organizationId,from,to)
   if(current===seq.current){setRows(result);setRange(`${from} a ${to}`)}
  }catch(cause){
   if(current===seq.current){
    const code=(cause as {code?:string}|null)?.code
    setError(code==='42501'||code==='28000'?
     'Seu perfil não possui permissão para consultar a DRE desta Loja.':
     'Não foi possível verificar os lançamentos contábeis neste período. Revise o intervalo e tente novamente.')
   }
  }finally{if(current===seq.current)setLoading(false)}
 }
 const months=rows?summarizeDre(rows):[]
 return <section className="panel dre-report" aria-label="DRE por competência">
  <h2>DRE — registros contábeis realizados</h2>
  <p className="subtle">Receitas e despesas contabilizadas, com seus códigos e naturezas históricas.
   Esta visão não é extrato de caixa e não inclui orçamento nem projeções futuras.</p>
  <form aria-label="Consultar DRE" onSubmit={submit}>
   <fieldset disabled={loading}>
    <div className="member-form-grid">
     <div><label htmlFor="dre-from">Competência inicial</label><input id="dre-from" name="from" type="month" required/></div>
     <div><label htmlFor="dre-to">Competência final</label><input id="dre-to" name="to" type="month" required/></div>
    </div>
    <button className="primary" type="submit">{loading?'Consultando…':'Consultar DRE'}</button>
   </fieldset>
  </form>
  {error&&<p role="alert" className="message error">{error}</p>}
  {loading&&<p role="status">Consultando dados contábeis…</p>}
  {rows&&!loading&&<>
   <p className="subtle">Período: {range}. Informações classificadas e registradas na contabilidade.</p>
   {!rows.length?<p>Nenhum lançamento contabilizado de resultado para este período.</p>:<>
    <h3>Resultado por competência</h3>
    <div className="finance-table" role="region" aria-label="Resultado contábil por competência" tabIndex={0}>
     <table><thead><tr><th>Competência</th><th>Receitas</th><th>Custos/despesas</th><th>Resultado</th></tr></thead>
      <tbody>{months.map(m=><tr key={m.month}>
       <th scope="row">{m.month.slice(0,7)}</th>
       <td>{formatMoney(m.revenue)}</td><td>{formatMoney(m.expenses)}</td><td>{formatMoney(m.result)}</td>
      </tr>)}</tbody>
     </table>
    </div>
    <h3>Lançamentos por conta contábil</h3>
    <div className="finance-table" role="region" aria-label="Contas na DRE" tabIndex={0}>
     <table><thead><tr><th>Competência</th><th>Código</th><th>Conta</th><th>Natureza</th><th>Valor assinado</th></tr></thead>
      <tbody>{rows.map((r,i)=><tr key={`${r.accounting_period}:${r.accounting_plan_id}:${r.accounting_account_id}:${i}`}>
       <td>{r.accounting_period.slice(0,7)}</td><td>{r.account_code}</td>
       <th scope="row">{r.account_description}</th>
       <td>{natureLabels[r.nature]}</td><td>{formatMoney(safeDreValue(r.signed_amount))}</td>
      </tr>)}</tbody>
     </table>
    </div>
   </>}
   <p className="subtle">Os valores são derivados de fatos contábeis, incluindo ajustes e cancelamentos,
    conforme a competência original. Não confunda saldo financeiro, crédito de integrante e resultado contábil.
    A consulta aceita no máximo 12 competências e bloqueia resultados acima de 1.500 linhas para evitar totais incompletos.</p>
  </>}
 </section>
}
