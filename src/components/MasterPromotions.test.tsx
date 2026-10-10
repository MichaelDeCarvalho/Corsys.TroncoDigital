import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterPromotions} from './MasterPromotions'
const id='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const series='faaf76e4-d796-430f-929f-71df5beaf832'
function fixture(withDraft=false,withPublished=false){
 const promotion={promotion_series_id:series,latest_promotion_id:id,version_number:1,
  name:'DESCONTO NOVO',public_code:'NOVO12',active:true,latest_version_status:withPublished?'published':'draft',
  valid_from:'2027-01-01T00:00:00Z',valid_to:null,redemption_count:0,can_delete:true,
  delete_block_reason:null}
 const data:Record<string,unknown[]>={v_saas_plan_version_admin:[],
  v_saas_promotion_series_admin:(withDraft||withPublished)?[promotion]:[]}
 const from=vi.fn((table:string)=>{
  const chain={select:()=>chain,order:()=>chain,limit:()=>chain,abortSignal:()=>Promise.resolve({data:data[table],error:null})}
  return chain
 })
 const rpc=vi.fn().mockResolvedValue({data:id,error:null})
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

})
