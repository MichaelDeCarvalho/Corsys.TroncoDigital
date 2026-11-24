import {fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterPromotions} from './MasterPromotions'
const id='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const series='faaf76e4-d796-430f-929f-71df5beaf832'
const draftDetail={
 id,
 name:'DESCONTO NOVO',
 public_code:'NOVO12',
 status:'draft',
 benefit_type:'percent',
 benefit_value:15,
 duration_type:'cycles',
 duration_cycles:3,
 valid_from:'2027-01-01T12:00:00.000Z',
 valid_to:null,
 eligibility_scope:'new_customers',
 max_redemptions:100,
 stackable:true,
}
function fixture(withDraft=false,withPublished=false,opts:{
 canDelete?:boolean
 deleteReason?:string|null
 active?:boolean
 promoDetail?:typeof draftDetail|null
 promoDetailError?:unknown
 rpcResult?:unknown
}={}) {
 const promotion={promotion_series_id:series,latest_promotion_id:id,version_number:1,
  name:'DESCONTO NOVO',public_code:'NOVO12',active:opts.active??true,latest_version_status:withPublished?'published':'draft',
  valid_from:'2027-01-01T00:00:00Z',valid_to:null,redemption_count:0,
  can_delete:opts.canDelete??true,delete_block_reason:opts.deleteReason??null}
 const data:Record<string,unknown[]>={
  v_saas_plan_version_admin:[],
  v_saas_promotion_series_admin:(withDraft||withPublished)?[promotion]:[],
  saas_promotions:opts.promoDetail===null?[]:[(opts.promoDetail??draftDetail)],
 }
 const from=vi.fn((table:string)=>{
  const chain={
   select:()=>chain,
   eq:()=>chain,
   order:()=>chain,
   limit:()=>chain,
   abortSignal:()=>Promise.resolve(
    table==='saas_promotions'&&opts.promoDetailError
     ?{data:null,error:opts.promoDetailError}
     :{data:data[table]??[],error:null},
   ),
  }
  return chain
 })
 const rpc=vi.fn().mockResolvedValue(opts.rpcResult??{data:id,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,rpc}
}
async function fill(){
 await screen.findByLabelText('Nome da oferta')
 fireEvent.change(screen.getByLabelText('Nome da oferta'),{target:{value:'Campanha de lançamento'}})
 fireEvent.change(screen.getByLabelText('Código público'),{target:{value:'NOVO12'}})
 fireEvent.change(screen.getByLabelText('Valor (R$ ou %)'),{target:{value:'12,00'}})
 fireEvent.change(screen.getByLabelText('Início (data e horário)'),{target:{value:'2027-01-01T12:00'}})
}
describe('Master SaaS promotion lifecycle',()=>{
 it('creates a draft with its own idempotency key, without automatic publication',async()=>{
  const {client,rpc}=fixture()
  render(<MasterPromotions client={client}/>)
  await fill()
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho de promoção'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('create_master_promotion_draft_idempotent',expect.objectContaining({
   p_name:'Campanha de lançamento',p_public_code:'NOVO12',
   p_benefit_type:'percent',p_benefit_value:'12.00',
   p_duration_type:'once',p_duration_cycles:null,
   p_eligibility_scope:'new_customers',p_idempotency_key:expect.any(String),
  })))
  expect(rpc).not.toHaveBeenCalledWith('publish_master_promotion_draft_idempotent',expect.anything())
 })
 it('publishes only an existing draft after explicit PUBLICAR acknowledgment',async()=>{
  const {client,rpc}=fixture(true)
  render(<MasterPromotions client={client}/>)
  await screen.findByLabelText('Oferta em rascunho')
  fireEvent.change(screen.getByLabelText('Oferta em rascunho'),{target:{value:id}})
  expect(screen.getByRole('button',{name:'Publicar oferta'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Para publicar, digite PUBLICAR'),{target:{value:'PUBLICAR'}})
  fireEvent.submit(screen.getByRole('form',{name:'Publicar promoção Master'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('publish_master_promotion_draft_idempotent',{
   p_promotion_id:id,p_idempotency_key:expect.any(String),
  }))
 })
 it('retries unchanged payload and key after uncertain transport',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(new Error('network lost'))
  render(<MasterPromotions client={client}/>)
  await fill()
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho de promoção'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1])
 })
 it('handles permission denial without retrying an unauthorized command',async()=>{
  const {client,rpc}=fixture()
  rpc.mockResolvedValueOnce({data:null,error:{code:'42501'}})
  render(<MasterPromotions client={client}/>)
  await fill()
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho de promoção'}))
  await screen.findByText('Operação exclusiva MASTER com MFA ativo.')
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
 })
 it('creates a versioned successor from the latest published offer, never an in-place edit',async()=>{
  const {client,rpc}=fixture(false,true)
  render(<MasterPromotions client={client}/>)
  await fill()
  fireEvent.change(screen.getByLabelText('Modalidade da versão'),{target:{value:id}})
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho de promoção'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('create_master_promotion_successor_idempotent',
   expect.objectContaining({
    p_current_promotion_id:id,p_public_code:'NOVO12',
    p_benefit_type:'percent',p_benefit_value:'12.00',
    p_idempotency_key:expect.any(String),
   })))
  expect(rpc).not.toHaveBeenCalledWith('update_saas_promotion_draft',expect.anything())
 })
 it('classifies PT409 stale source as a definitive conflict, never an uncertain retry',async()=>{
  const {client,rpc}=fixture(false,true)
  rpc.mockResolvedValueOnce({data:null,error:{code:'PT409'}})
  render(<MasterPromotions client={client}/>)
  await fill()
  fireEvent.change(screen.getByLabelText('Modalidade da versão'),{target:{value:id}})
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho de promoção'}))
  await screen.findByText('A oferta foi alterada. Atualize o catálogo antes de criar uma nova versão.')
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
  expect(rpc).toHaveBeenCalledTimes(1)
 })
 it('excludes published offers from in-place draft editing and edits loaded draft offers with full validation',async()=>{
  const published=fixture(false,true)
  const {unmount}=render(<MasterPromotions client={published.client}/>)
  const editSelect=await screen.findByLabelText('Rascunho de oferta para editar')
  expect(editSelect).toBeDisabled()
  expect(within(editSelect).queryByRole('option',{name:/NOVO12/})).not.toBeInTheDocument()
  unmount()

  const failDetail=fixture(true,false,{promoDetailError:{code:'50000'}})
  const {unmount:unmountFail}=render(<MasterPromotions client={failDetail.client}/>)
  fireEvent.change(await screen.findByLabelText('Rascunho de oferta para editar'),{target:{value:id}})
  await screen.findByText('Não foi possível carregar os detalhes completos do rascunho da oferta.')
  expect(screen.queryByRole('button',{name:'Salvar alterações da oferta'})).not.toBeInTheDocument()
  unmountFail()

  const onCatalogChange=vi.fn()
  const draftFix=fixture(true,false)
  render(<MasterPromotions client={draftFix.client} onCatalogChange={onCatalogChange}/>)
  fireEvent.change(await screen.findByLabelText('Rascunho de oferta para editar'),{target:{value:id}})
  await waitFor(()=>expect(screen.getByLabelText('Nome do rascunho da oferta')).toHaveValue('DESCONTO NOVO'))
  expect(screen.getByLabelText('Ciclos do rascunho')).toHaveValue(3)
  fireEvent.change(screen.getByLabelText('Nome do rascunho da oferta'),{target:{value:'Campanha Revisada'}})
  fireEvent.change(screen.getByLabelText('Código público do rascunho'),{target:{value:'rev20'}})
  fireEvent.change(screen.getByLabelText('Valor do rascunho (R$ ou %)'),{target:{value:'20,00'}})
  fireEvent.change(screen.getByLabelText('Ciclos do rascunho'),{target:{value:'6'}})
  fireEvent.submit(screen.getByRole('form',{name:'Editar rascunho de promoção'}))
  await screen.findByText('Alterações no rascunho promocional confirmadas. A oferta ainda não está publicada.')
  expect(draftFix.rpc).toHaveBeenCalledWith('update_saas_promotion_draft',{
   p_promotion_id:id,
   p_name:'Campanha Revisada',
   p_public_code:'REV20',
   p_benefit_type:'percent',
   p_benefit_value:'20.00',
   p_duration_type:'cycles',
   p_duration_cycles:6,
   p_valid_from:expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
   p_valid_to:null,
   p_eligibility_scope:'new_customers',
   p_max_redemptions:100,
   p_stackable:true,
  })
  expect(onCatalogChange).toHaveBeenCalledTimes(1)
 })
 it('deactivates/reactivates promotion series with reason and restricts deletion to unused series with EXCLUIR confirmation',async()=>{
  const blocked=fixture(false,true,{canDelete:false,deleteReason:'published_history_exists',active:true})
  const {unmount}=render(<MasterPromotions client={blocked.client}/>)
  fireEvent.change(await screen.findByLabelText('Série de oferta para ativação ou exclusão'),{target:{value:series}})
  expect(screen.getByText('Exclusão bloqueada: possui histórico publicado')).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Desativar série de oferta'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Motivo da alteração da oferta'),{target:{value:'Encerramento sazonal'}})
  fireEvent.change(screen.getByLabelText('Para excluir oferta sem uso, digite EXCLUIR'),{target:{value:'EXCLUIR'}})
  expect(screen.getByRole('button',{name:'Excluir série sem uso'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Desativar série de oferta'}))
  await screen.findByText('Série promocional desativada com confirmação. O histórico publicado foi preservado.')
  expect(blocked.rpc).toHaveBeenCalledWith('set_saas_promotion_series_active',{
   p_promotion_series_id:series,p_active:false,p_reason:'Encerramento sazonal',
  })
  unmount()

  const unused=fixture(true,false,{canDelete:true,deleteReason:null,rpcResult:{data:true,error:null}})
  render(<MasterPromotions client={unused.client}/>)
  fireEvent.change(await screen.findByLabelText('Série de oferta para ativação ou exclusão'),{target:{value:series}})
  fireEvent.change(screen.getByLabelText('Motivo da alteração da oferta'),{target:{value:'Rascunho duplicado sem uso'}})
  fireEvent.change(screen.getByLabelText('Para excluir oferta sem uso, digite EXCLUIR'),{target:{value:'EXCLUIR'}})
  expect(screen.getByRole('button',{name:'Excluir série sem uso'})).not.toBeDisabled()
  fireEvent.submit(screen.getByRole('form',{name:'Gerenciar série da oferta'}))
  await screen.findByText('Série promocional sem uso excluída com registro de auditoria.')
  expect(unused.rpc).toHaveBeenCalledWith('delete_saas_promotion_series_if_unused',{
   p_promotion_series_id:series,p_reason:'Rascunho duplicado sem uso',
  })
 })
 it('handles SQLSTATE 55000 promotion deletion block without retry',async()=>{
  const {client,rpc}=fixture(true,false,{canDelete:true,rpcResult:{data:null,error:{code:'55000'}}})
  render(<MasterPromotions client={client}/>)
  fireEvent.change(await screen.findByLabelText('Série de oferta para ativação ou exclusão'),{target:{value:series}})
  fireEvent.change(screen.getByLabelText('Motivo da alteração da oferta'),{target:{value:'Tentativa após resgate concorrente'}})
  fireEvent.change(screen.getByLabelText('Para excluir oferta sem uso, digite EXCLUIR'),{target:{value:'EXCLUIR'}})
  fireEvent.submit(screen.getByRole('form',{name:'Gerenciar série da oferta'}))
  await screen.findByText('O banco bloqueou a exclusão porque a série possui histórico publicado ou uso registrado; desative a série em vez de excluir.')
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
 })
})
