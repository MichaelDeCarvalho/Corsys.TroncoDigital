import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MemberAgreements} from './MemberAgreements'
import {loadManualChargeCatalog,loadMemberCharges} from '../lib/manual-charges'
import {loadMemberAgreements,loadAgreementInstallments,validateAgreementPreview,agreementCents,type AgreementInput} from '../lib/member-agreements'
vi.mock('../lib/manual-charges',()=>({loadManualChargeCatalog:vi.fn(),loadMemberCharges:vi.fn()}))
vi.mock('../lib/member-agreements',async importOriginal=>({...await importOriginal<typeof import('../lib/member-agreements')>(),loadMemberAgreements:vi.fn(),loadAgreementInstallments:vi.fn()}))
const org='94b84958-4dd9-435d-9a4e-244220835d70',member='d5842ad6-913d-4a3e-8250-876fb2e2a215',charge='6d9b6897-0f5f-45b8-b82a-88a53cf02577',id='7e84d099-fd54-4787-9eb5-29b01313abca'
const input:AgreementInput={p_organization_id:org,p_member_id:member,p_charge_ids:[charge],p_amount:'10.00',p_installment_count:3,p_agreement_date:'2026-10-19',p_first_due:'2027-01-31'}
const preview={organization_id:org,member_id:member,original_amount:15,negotiated_amount:10,installment_count:3,agreement_date:input.p_agreement_date,first_due:input.p_first_due,fingerprint:'a'.repeat(64),items:[{charge_id:charge,open:15}],installments:[{number:1,due_date:'2027-01-31',amount:3.34},{number:2,due_date:'2027-02-28',amount:3.33},{number:3,due_date:'2027-03-31',amount:3.33}]}
function fixture(){
 vi.mocked(loadManualChargeCatalog).mockResolvedValue({members:[{id:member,organization_id:org,full_name:'Integrante fictício',status:'active'}],categories:[]})
 vi.mocked(loadMemberCharges).mockResolvedValue([{charge_id:charge,organization_id:org,member_id:member,description:'Débito fictício',competence:'2026-10-01',due_date:'2026-10-10',open_amount:15,integrity_ok:true,is_cancelled:false}])
 vi.mocked(loadMemberAgreements).mockResolvedValue([])
 const rpc=vi.fn<(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:{code?:string}|null}>>(async name=>({data:name==='preview_member_debt_agreement'?preview:id,error:null}))
 return {rpc,client:{rpc} as unknown as SupabaseClient}
}
async function review(){
 await screen.findByRole('option',{name:'Integrante fictício'});fireEvent.change(screen.getByLabelText('Integrante da negociação'),{target:{value:member}})
 fireEvent.click(await screen.findByRole('checkbox'))
 fireEvent.change(screen.getByLabelText('Valor negociado (R$)'),{target:{value:'10,00'}})
 fireEvent.change(screen.getByLabelText('Quantidade de parcelas'),{target:{value:'3'}})
 fireEvent.change(screen.getByLabelText('Data do acordo'),{target:{value:input.p_agreement_date}})
 fireEvent.change(screen.getByLabelText('Primeiro vencimento'),{target:{value:input.p_first_due}})
 fireEvent.change(screen.getByLabelText('Motivo e condições'),{target:{value:'Condições fictícias aprovadas'}})
 fireEvent.click(screen.getByRole('button',{name:'Conferir negociação'}));await screen.findByRole('heading',{name:'Confira as parcelas'})
}
function confirm(){fireEvent.change(screen.getByLabelText('Digite NEGOCIAR para confirmar'),{target:{value:'NEGOCIAR'}});fireEvent.click(screen.getByRole('button',{name:'Confirmar acordo'}))}
describe('member agreement',()=>{
 it('checks tenant, selected debts and exact cents before allowing confirmation',()=>{
  expect(validateAgreementPreview(preview,input)).toEqual(preview)
  for(const invalid of [{...preview,organization_id:'foreign'},{...preview,items:[{charge_id:id,open:15}]},{...preview,installments:preview.installments.map((x,i)=>i===2?{...x,amount:3.34}:x)}])expect(()=>validateAgreementPreview(invalid,input)).toThrow()
  expect(agreementCents('999999999999.99')).toBe(99999999999999)
  expect(()=>agreementCents('NaN')).toThrow()
 })
 it('previews a cent-balanced schedule then confirms once and refreshes the history',async()=>{
  const f=fixture();render(<MemberAgreements client={f.client} organizationId={org}/>);await review()
  expect(f.rpc).toHaveBeenCalledWith('preview_member_debt_agreement',input)
  expect(screen.getByRole('button',{name:'Confirmar acordo'})).toBeDisabled()
  confirm();await screen.findByText('Acordo confirmado. Cobranças e parcelas atualizadas.')
  expect(f.rpc.mock.calls.filter(([name])=>name==='create_member_debt_agreement')).toHaveLength(1)
  expect(screen.queryByRole('heading',{name:'Confira as parcelas'})).not.toBeInTheDocument()
  expect(loadMemberAgreements).toHaveBeenCalledWith(f.client,org,member,expect.any(AbortSignal))
 })
 it('invalidates the preview when terms or selected debts change',async()=>{
  const f=fixture();render(<MemberAgreements client={f.client} organizationId={org}/>);await review()
  fireEvent.change(screen.getByLabelText('Quantidade de parcelas'),{target:{value:'2'}})
  expect(screen.queryByRole('button',{name:'Confirmar acordo'})).not.toBeInTheDocument()
  expect(f.rpc.mock.calls.filter(([name])=>name==='create_member_debt_agreement')).toHaveLength(0)
 })
 it('preserves payload/key after an uncertain response and unlocks on definitive PT409',async()=>{
  const f=fixture();let calls=0
  f.rpc.mockImplementation(async name=>name==='preview_member_debt_agreement'?{data:preview,error:null}:++calls===1?{data:null,error:{}}:{data:null,error:{code:'PT409'}})
  render(<MemberAgreements client={f.client} organizationId={org}/>);await review();confirm()
  const verify=await screen.findByRole('button',{name:'Verificar envio'})
  expect(screen.getByLabelText('Integrante da negociação')).toBeDisabled()
  fireEvent.click(verify);await screen.findByText('Os débitos ou condições mudaram. Confira uma nova prévia antes de confirmar.')
  const sent=f.rpc.mock.calls.filter(([name])=>name==='create_member_debt_agreement')
  expect(sent).toHaveLength(2);expect(sent[1][1]).toEqual(sent[0][1])
  await waitFor(()=>expect(screen.getByLabelText('Integrante da negociação')).toBeEnabled())
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
 })
 it('does not expose a confirmation for a foreign preview',async()=>{
  const f=fixture();f.rpc.mockResolvedValue({data:{...preview,organization_id:id},error:null})
  render(<MemberAgreements client={f.client} organizationId={org}/>)
  await screen.findByRole('option',{name:'Integrante fictício'});fireEvent.change(screen.getByLabelText('Integrante da negociação'),{target:{value:member}})
  fireEvent.click(await screen.findByRole('checkbox'));fireEvent.change(screen.getByLabelText('Valor negociado (R$)'),{target:{value:'10'}})
  fireEvent.change(screen.getByLabelText('Motivo e condições'),{target:{value:'Teste fictício'}})
  fireEvent.submit(screen.getByRole('form',{name:'Preparar negociação'}));await screen.findByRole('alert')
  expect(screen.queryByRole('button',{name:'Confirmar acordo'})).not.toBeInTheDocument()
 })
 it('opens persisted installments from the agreement history',async()=>{
  const f=fixture();vi.mocked(loadMemberAgreements).mockResolvedValue([{id,organization_id:org,member_id:member,agreement_date:'2026-10-19',original_amount:15,negotiated_amount:10,installment_count:1,reason:'Fictício'}])
  vi.mocked(loadAgreementInstallments).mockResolvedValue([{installment_number:1,charge_id:charge,due_date:'2026-11-01',amount:10}])
  render(<MemberAgreements client={f.client} organizationId={org}/>);await screen.findByRole('option',{name:'Integrante fictício'})
  fireEvent.change(screen.getByLabelText('Integrante da negociação'),{target:{value:member}})
  fireEvent.click(await screen.findByRole('button',{name:/Ver parcelas de/}));await screen.findByRole('list',{name:'Parcelas do acordo'})
  expect(loadAgreementInstallments).toHaveBeenCalledWith(f.client,org,expect.objectContaining({id}),expect.any(AbortSignal))
 })
})
