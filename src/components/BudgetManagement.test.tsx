import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {BudgetManagement} from './BudgetManagement'
import {loadBudgetDetail} from '../lib/budget-management'
const org='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b',id='6f953af3-c600-4bf2-ae3c-4ff1a0c63236'
const account='2ef210ff-e7f5-46db-89b2-5ac571bbb089'
function fixture(options:{published?:boolean;empty?:boolean;foreign?:boolean}={}){
 const cycle={id,organization_id:options.foreign?'other':org,name:'Orçamento 2027',
  status:options.published?'published':'draft',currency:'BRL',period_start:'2027-01-01',period_end:'2027-12-01'}
 const detail={cycle,revision:'a'.repeat(32),lines:options.empty?[]:[{
  kind:'account',item_id:account,period:'2027-01-01',amount:'250.00',label:'Mensalidades',
 }]}
 const data:Record<string,unknown[]>={budget_cycles:[cycle],accounting_accounts:[{
  id:account,organization_id:org,code:'1',description:'Mensalidades',nature:'revenue',
 }],funds:[]}
 const command=vi.fn().mockResolvedValue({data:id,error:null})
 const rpc=vi.fn((name:string,args:Record<string,unknown>)=>name==='read_tenant_budget_detail'?
  {abortSignal:()=>Promise.resolve({data:detail,error:null})}:command(name,args))
 const from=vi.fn((name:string)=>{const chain={select:()=>chain,eq:()=>chain,order:()=>chain,
  limit:()=>chain,abortSignal:()=>Promise.resolve({data:data[name],error:null})};return chain})
 return {client:{rpc,from} as unknown as SupabaseClient,command,detail}
}
async function choose(){
 await screen.findByRole('option',{name:'Orçamento 2027 — draft'})
 fireEvent.change(screen.getByLabelText('Orçamento para revisar'),{target:{value:id}})
 await screen.findByText('Mensalidades',{selector:'th'})
}
describe('Budget lifecycle',()=>{
 it('creates a draft with explicit competence range and tenant',async()=>{
  const {client,command}=fixture();render(<BudgetManagement client={client} organizationId={org}/>)
  await screen.findByRole('option',{name:'Orçamento 2027 — draft'})
  fireEvent.change(screen.getByLabelText('Nome do ciclo'),{target:{value:'Orçamento novo'}})
  fireEvent.change(screen.getByLabelText('Competência inicial'),{target:{value:'2027-01'}})
  fireEvent.change(screen.getByLabelText('Competência final'),{target:{value:'2027-12'}})
  fireEvent.change(screen.getByLabelText('Motivo do novo ciclo'),{target:{value:'Planejamento anual'}})
  fireEvent.submit(screen.getByRole('form',{name:'Criar ciclo orçamentário'}))
  await waitFor(()=>expect(command).toHaveBeenCalledWith('create_tenant_budget_draft',{
   p_organization_id:org,p_name:'Orçamento novo',p_period_start:'2027-01-01',p_period_end:'2027-12-01',
   p_reason:'Planejamento anual',p_idempotency_key:expect.any(String),
  }))
 })
 it('sends the reviewed version when saving a monetary line',async()=>{
  const {client,command}=fixture();render(<BudgetManagement client={client} organizationId={org}/>)
  await choose()
  fireEvent.change(screen.getByLabelText('Conta ou fundo'),{target:{value:account}})
  fireEvent.change(screen.getByLabelText('Competência da linha'),{target:{value:'2027-01'}})
  fireEvent.change(screen.getByLabelText('Valor orçado (R$)'),{target:{value:'350,10'}})
  fireEvent.change(screen.getByLabelText('Motivo da alteração'),{target:{value:'Revisão anual'}})
  fireEvent.submit(screen.getByRole('form',{name:'Salvar linha orçamentária'}))
  await waitFor(()=>expect(command).toHaveBeenCalledWith('set_tenant_budget_line',{
   p_organization_id:org,p_cycle_id:id,p_kind:'account',p_item_id:account,p_period:'2027-01-01',
   p_amount:'350.10',p_expected_revision:'a'.repeat(32),p_reason:'Revisão anual',p_idempotency_key:expect.any(String),
  }))
 })
 it('requires typed publication and sends the exact reviewed version',async()=>{
  const {client,command}=fixture();render(<BudgetManagement client={client} organizationId={org}/>)
  await choose();expect(screen.getByRole('button',{name:'Publicar orçamento revisado'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Motivo da alteração'),{target:{value:'Aprovação do planejamento'}})
  fireEvent.change(screen.getByLabelText('Digite PUBLICAR'),{target:{value:'PUBLICAR'}})
  fireEvent.click(screen.getByRole('button',{name:'Publicar orçamento revisado'}))
  await waitFor(()=>expect(command).toHaveBeenCalledWith('publish_tenant_budget',expect.objectContaining({
   p_organization_id:org,p_cycle_id:id,p_expected_revision:'a'.repeat(32),
  })))
 })
 it('replays uncertain publication with the same key and payload',async()=>{
  const {client,command}=fixture();command.mockRejectedValueOnce(new Error('transport lost'))
  render(<BudgetManagement client={client} organizationId={org}/>);await choose()
  fireEvent.change(screen.getByLabelText('Motivo da alteração'),{target:{value:'Aprovação do planejamento'}})
  fireEvent.change(screen.getByLabelText('Digite PUBLICAR'),{target:{value:'PUBLICAR'}})
  fireEvent.click(screen.getByRole('button',{name:'Publicar orçamento revisado'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  expect(screen.getByLabelText('Orçamento para revisar')).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(command).toHaveBeenCalledTimes(2))
  expect(command.mock.calls[0]).toEqual(command.mock.calls[1])
 })
 it('handles stale versions as rejected commands rather than uncertain successes',async()=>{
  const {client,command}=fixture();command.mockResolvedValueOnce({data:null,error:{code:'40001'}})
  render(<BudgetManagement client={client} organizationId={org}/>);await choose()
  fireEvent.change(screen.getByLabelText('Motivo da alteração'),{target:{value:'Planejamento atualizado'}})
  fireEvent.click(screen.getByRole('button',{name:'Remover linha'}))
  await screen.findByText(/O orçamento mudou/)
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
 })
 it('does not offer edits of a published budget',async()=>{
  const {client,command}=fixture({published:true});render(<BudgetManagement client={client} organizationId={org}/>)
  await screen.findByRole('option',{name:'Orçamento 2027 — published'})
  fireEvent.change(screen.getByLabelText('Orçamento para revisar'),{target:{value:id}})
  await screen.findByText(/Orçamento publicado: alterações bloqueadas/)
  expect(screen.queryByRole('button',{name:'Salvar linha'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Remover linha'})).not.toBeInTheDocument()
  expect(command).not.toHaveBeenCalled()
 })
 it('rejects cross-tenant detail and duplicate lines before rendering',async()=>{
  const signal=new AbortController().signal,foreign=fixture({foreign:true})
  await expect(loadBudgetDetail(foreign.client,org,id,signal)).rejects.toThrow()
  const duplicate=fixture();duplicate.detail.lines.push({...duplicate.detail.lines[0]})
  await expect(loadBudgetDetail(duplicate.client,org,id,signal)).rejects.toThrow()
 })
})
