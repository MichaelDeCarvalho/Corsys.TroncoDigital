import {fireEvent,render,screen,within} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterCommercialCatalog} from './MasterCommercialCatalog'
import {loadPlatformCommercialCatalog} from '../lib/master-commercial'
const plan={
 plan_id:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',
 plan_active:true,
 plan_version_id:'559ba052-c408-4418-b806-0c0c4b8e3603',
 version_number:1,display_name_snapshot:'Plano ESSENCIAL',
 internal_code_snapshot:'ESSENCIAL',price:'125.00',currency:'BRL',
 billing_interval:'monthly',trial_days:0,grace_days:7,valid_from:'2026-10-01',
 valid_to:null,publication_status:'published',admin_status:'current',
 can_delete_plan:false,delete_block_reason:'published',
}
const promo={
 promotion_series_id:'b112d600-bf1a-4bfd-bc1c-e9e9b749b539',
 latest_promotion_id:'faaf76e4-d796-430f-929f-71df5beaf832',
 version_number:1,name:'Oferta TESTE',public_code:'DEV',
 active:true,latest_version_status:'published',valid_from:null,valid_to:null,
 redemption_count:0,can_delete:false,delete_block_reason:'used',
}
function fixture(opts:{deny?:boolean;brokenPrice?:boolean;duplicate?:boolean}={}){
 const from=vi.fn((table:string)=>{
  const chain={select:()=>chain,order:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:table==='v_saas_plan_version_admin'?
     (opts.duplicate?[plan,plan]:[{...plan,price:opts.brokenPrice?'NaN':'125.00'}]):
     [promo],error:opts.deny?{code:'42501'}:null})}
  return chain
 })
 return {client:{from} as unknown as SupabaseClient,from}
}
describe('Master commercial version history',()=>{
 it('shows historical SaaS prices and promotion series without altering subscriptions',async()=>{
  const {client,from}=fixture()
  render(<MasterCommercialCatalog client={client}/>)
  await screen.findByText('Plano ESSENCIAL')
  expect(screen.getByText('Oferta TESTE')).toBeInTheDocument()
  expect(screen.getByText(/R\$\s?125,00/)).toBeInTheDocument()
  expect(from).toHaveBeenCalledWith('v_saas_plan_version_admin')
  expect(from).toHaveBeenCalledWith('v_saas_promotion_series_admin')
 })
 it('shows no Master commercial data if the server denies access',async()=>{
  const {client}=fixture({deny:true})
  render(<MasterCommercialCatalog client={client}/>)
  expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0)
  expect(screen.queryByText('Plano ESSENCIAL')).not.toBeInTheDocument()
 })
 it('rejects invalid prices rather than displaying a commercial offer',async()=>{
  const {client}=fixture({brokenPrice:true})
  await expect(loadPlatformCommercialCatalog(client,new AbortController().signal)).rejects.toThrow()
 })
 it('rejects duplicate plan versions rather than silently selecting a row',async()=>{
  const {client}=fixture({duplicate:true})
  await expect(loadPlatformCommercialCatalog(client,new AbortController().signal)).rejects.toThrow()
 })
})
