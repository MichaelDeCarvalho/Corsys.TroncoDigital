import {fireEvent,render,screen,waitFor,act} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {InstitutionalMonthly} from './InstitutionalMonthly'
import {loadInstitutionalMonthlyCatalog,previewInstitutionalMonthly} from '../lib/institutional-monthly'
const org='94b84958-4dd9-435d-9a4e-244220835d70',foreign='7a6aa771-524d-4d5a-9d38-7006175e1cb4'
const ruleId='b6116441-5a43-4661-8d5b-1a844c48f6b5',category='6af9f28f-b43d-4a4a-9c14-d6357bfa9c90',fact='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const rule={id:ruleId,organization_id:org,direction:'payable' as const,category_id:category,name:'DEV QA despesa mensal',counterparty_name:'DEV QA fornecedor',frequency:'monthly' as const,due_day:31,active:true}
const preview={organization_id:org,rule_id:ruleId,competence:'2026-10-01',name:rule.name,direction:'payable',active:true,frequency:'monthly',
 category_id:category,category_active:true,category_domain:'institutional_expense',counterparty:rule.counterparty_name,version_id:fact,amount:'1.00',due_date:'2026-10-31',
 accounting_plan_id:fact,accounting_account_id:fact,existing_id:null,period_closed:false,ready:true,fingerprint:'a'.repeat(64)}
function fixture(overrides:Record<string,unknown[]>={}){
 const data:Record<string,unknown[]>={institutional_recurring_rules:[rule],financial_categories:[{id:category,organization_id:org,name:'DEV QA despesa',domain:'institutional_expense',active:true}],...overrides}
 const from=vi.fn((name:string)=>{const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:()=>q,abortSignal:()=>Promise.resolve({data:data[name],error:null})};return q})
 const rpc=vi.fn<(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:{code?:string}|null}>>(async(name:string)=>({data:name==='preview_institutional_monthly_generation'?preview:fact,error:null}))
 return {client:{from,rpc} as unknown as SupabaseClient,rpc,data}
}
async function select(){
 await screen.findByText(/DEV QA despesa mensal — Despesa — Ativa/)
 fireEvent.change(screen.getByLabelText('Regra institucional para emissão'),{target:{value:ruleId}})
 fireEvent.change(screen.getByLabelText('Competência da emissão institucional'),{target:{value:'2026-10'}})
}
async function consult(){await select();fireEvent.click(screen.getByRole('button',{name:'Conferir prévia institucional'}));await screen.findByText('Uma obrigação pronta para emissão.')}
function confirm(){
 fireEvent.change(screen.getByLabelText('Justificativa da emissão institucional'),{target:{value:'DEV QA emissão autorizada'}})
 fireEvent.change(screen.getByLabelText('Digite GERAR para emitir a obrigação'),{target:{value:'GERAR'}})
 fireEvent.submit(screen.getByRole('form',{name:'Confirmar emissão institucional'}))
}
describe('institutional monthly UI',()=>{
 it('schedules a reviewed future price and invalidates the old generation preview',async()=>{
  const f=fixture();render(<InstitutionalMonthly client={f.client} organizationId={org}/>);await consult()
  fireEvent.change(screen.getByLabelText('Novo valor institucional (R$)'),{target:{value:'2,50'}})
  fireEvent.change(screen.getByLabelText('Início do reajuste institucional'),{target:{value:'2027-01'}})
  fireEvent.change(screen.getByLabelText('Motivo do reajuste institucional'),{target:{value:'DEV reajuste autorizado'}})
  fireEvent.change(screen.getByLabelText('Digite REAJUSTAR para confirmar'),{target:{value:'REAJUSTAR'}})
  fireEvent.submit(screen.getByRole('form',{name:'Programar reajuste institucional'}))
  await screen.findByText(/Operação recorrente institucional confirmada/)
  expect(f.rpc).toHaveBeenCalledWith('schedule_institutional_recurring_price',{
   p_organization_id:org,p_rule_id:ruleId,p_expected_version_id:fact,p_amount:'2.50',p_valid_from:'2027-01-01',
   p_reason:'DEV reajuste autorizado',p_idempotency_key:expect.any(String)})
  expect(screen.queryByRole('form',{name:'Confirmar emissão institucional'})).not.toBeInTheDocument()
 })
 it('does not schedule an unconfirmed price',async()=>{
  const f=fixture();render(<InstitutionalMonthly client={f.client} organizationId={org}/>);await consult()
  fireEvent.change(screen.getByLabelText('Novo valor institucional (R$)'),{target:{value:'2,50'}})
  fireEvent.change(screen.getByLabelText('Início do reajuste institucional'),{target:{value:'2027-01'}})
  fireEvent.change(screen.getByLabelText('Motivo do reajuste institucional'),{target:{value:'DEV reajuste autorizado'}})
  fireEvent.submit(screen.getByRole('form',{name:'Programar reajuste institucional'}))
  await screen.findByText('Confira valor, vigência e confirmação do reajuste.')
  expect(f.rpc).toHaveBeenCalledTimes(1)
 })
 it('treats PT409 as a known conflict, clears stale preview and requires a fresh review',async()=>{
  const f=fixture();f.rpc.mockResolvedValueOnce({data:preview,error:null}).mockResolvedValueOnce({data:null,error:{code:'PT409'}})
  render(<InstitutionalMonthly client={f.client} organizationId={org}/>);await consult();confirm()
  await screen.findByText('A regra ou a prévia mudou. Atualize e confira uma nova prévia.')
  expect(screen.queryByRole('form',{name:'Confirmar emissão institucional'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Verificar operação recorrente com a mesma chave'})).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Conferir prévia institucional'})).toBeEnabled()
 })

 it('does not generate from preview; requires typed confirmation and sends the reviewed fingerprint',async()=>{
  const f=fixture();render(<InstitutionalMonthly client={f.client} organizationId={org}/>);await consult()
  expect(f.rpc).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Confirmar emissão institucional'})).toBeDisabled()
  confirm();await screen.findByText(/Operação recorrente institucional confirmada/)
  expect(f.rpc).toHaveBeenCalledWith('generate_institutional_monthly_obligation',{
   p_organization_id:org,p_rule_id:ruleId,p_competence:'2026-10-01',p_expected_fingerprint:'a'.repeat(64),p_reason:'DEV QA emissão autorizada',p_idempotency_key:expect.any(String)})
 })
 it('discards preview immediately on competence change and cannot submit the old generation form',async()=>{
  const f=fixture();render(<InstitutionalMonthly client={f.client} organizationId={org}/>);await consult()
  fireEvent.change(screen.getByLabelText('Competência da emissão institucional'),{target:{value:'2026-11'}})
  expect(screen.queryByRole('form',{name:'Confirmar emissão institucional'})).not.toBeInTheDocument();expect(f.rpc).toHaveBeenCalledTimes(1)
 })
 it('updating during slow preview releases the form and ignores the obsolete response',async()=>{
  const f=fixture();let resolve!:(v:{data:unknown;error:null})=>void
  f.rpc.mockReturnValueOnce(new Promise(r=>{resolve=r}))
  render(<InstitutionalMonthly client={f.client} organizationId={org}/>);await select()
  fireEvent.click(screen.getByRole('button',{name:'Conferir prévia institucional'}));fireEvent.click(screen.getByRole('button',{name:'Atualizar regras institucionais'}))
  await select();await act(async()=>resolve({data:preview,error:null}))
  expect(screen.queryByText('Uma obrigação pronta para emissão.')).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Conferir prévia institucional'})).toBeEnabled()
  fireEvent.click(screen.getByRole('button',{name:'Conferir prévia institucional'}));await screen.findByText('Uma obrigação pronta para emissão.')
  expect(f.rpc.mock.calls.every(([name])=>name==='preview_institutional_monthly_generation')).toBe(true)
 })
 it('retries an uncertain generation with identical key and fingerprint',async()=>{
  const f=fixture();f.rpc.mockResolvedValueOnce({data:preview,error:null}).mockRejectedValueOnce(Error('timeout')).mockResolvedValueOnce({data:fact,error:null})
  render(<InstitutionalMonthly client={f.client} organizationId={org}/>);await consult();confirm()
  fireEvent.click(await screen.findByRole('button',{name:'Verificar operação recorrente com a mesma chave'}))
  await screen.findByText(/Operação recorrente institucional confirmada/);expect(f.rpc.mock.calls[2]).toEqual(f.rpc.mock.calls[1])
 })
 it('blocks emission when that month was already generated, even if canceled',async()=>{
  const f=fixture();f.rpc.mockResolvedValueOnce({data:{...preview,ready:false,existing_id:fact},error:null})
  render(<InstitutionalMonthly client={f.client} organizationId={org}/>);await select();fireEvent.click(screen.getByRole('button',{name:'Conferir prévia institucional'}))
  await screen.findByText('Já emitida nesta competência, inclusive se cancelada.');expect(screen.queryByRole('form',{name:'Confirmar emissão institucional'})).not.toBeInTheDocument()
 })
 it('sends optimistic status and reason without editing posted obligations',async()=>{
  const f=fixture();render(<InstitutionalMonthly client={f.client} organizationId={org}/>);await select()
  fireEvent.change(screen.getByLabelText('Justificativa da situação da regra'),{target:{value:'DEV QA desativação'}})
  fireEvent.submit(screen.getByRole('form',{name:'Alterar situação da regra institucional'}))
  await waitFor(()=>expect(f.rpc).toHaveBeenCalledWith('set_tenant_institutional_monthly_rule_status',expect.objectContaining({p_organization_id:org,p_rule_id:ruleId,p_expected_active:true,p_active:false,p_reason:'DEV QA desativação'})))
 })
 it('creates a monthly institutional rule from the scoped category and explicit amount/date',async()=>{
  const f=fixture();render(<InstitutionalMonthly client={f.client} organizationId={org}/>);await select()
  fireEvent.change(screen.getByLabelText('Descrição da regra institucional'),{target:{value:'DEV QA mensal'}})
  fireEvent.change(screen.getByLabelText('Categoria da regra institucional'),{target:{value:category}})
  fireEvent.change(screen.getByLabelText('Fornecedor ou origem recorrente'),{target:{value:'DEV QA fornecedor'}})
  fireEvent.change(screen.getByLabelText('Valor mensal institucional (R$)'),{target:{value:'1,00'}})
  fireEvent.change(screen.getByLabelText('Vigência inicial institucional'),{target:{value:'2026-10'}})
  fireEvent.change(screen.getByLabelText('Justificativa da nova regra'),{target:{value:'DEV QA cadastro'}})
  fireEvent.submit(screen.getByRole('form',{name:'Cadastrar recorrência institucional'}))
  await waitFor(()=>expect(f.rpc).toHaveBeenCalledWith('create_tenant_institutional_monthly_rule',expect.objectContaining({p_organization_id:org,p_direction:'payable',p_category_id:category,p_amount:'1.00',p_valid_from:'2026-10-01',p_due_day:20})))
 })
})
describe('institutional monthly response integrity',()=>{
 it.each([
  {organization_id:foreign},{rule_id:foreign},{competence:'2026-11-01'},{fingerprint:'invalid'},
  {amount:'NaN'},{due_date:'2026-02-30'},{ready:true,period_closed:true},{ready:true,existing_id:fact},
  {ready:true,accounting_account_id:null},{direction:'receivable'},
 ])('rejects mismatched preview %j',async override=>{
  const f=fixture();f.rpc.mockResolvedValue({data:{...preview,...override},error:null})
  await expect(previewInstitutionalMonthly(f.client,org,rule,'2026-10-01')).rejects.toThrow()
 })
 it.each([
  {institutional_recurring_rules:[{...rule,organization_id:foreign}]},
  {institutional_recurring_rules:[rule,rule]},
  {institutional_recurring_rules:Array.from({length:151},()=>rule)},
  {institutional_recurring_rules:[{...rule,due_day:32}]},
  {institutional_recurring_rules:[{...rule,frequency:'annual'}]},
 ])('rejects unsafe catalog %j',async override=>{
  const f=fixture(override);await expect(loadInstitutionalMonthlyCatalog(f.client,org,new AbortController().signal)).rejects.toThrow()
 })
})
