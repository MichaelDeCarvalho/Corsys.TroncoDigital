import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {PlatformIdentityEditor} from './PlatformIdentityEditor'
import type {PlatformConfiguration} from '../lib/master-config'

const config={trade_name:'CorSys',legal_name:null,tax_id:null,postal_code:null,address_line:null,city:null,state_code:null,billing_email:null,support_email:null,support_phone:null,updated_at:'2026-11-25T12:00:00Z'} as PlatformConfiguration
function setup(result:unknown={data:'2026-11-25T13:00:00Z',error:null}){
 const rpc=vi.fn().mockResolvedValue(result),onSaved=vi.fn()
 render(<PlatformIdentityEditor client={{rpc} as unknown as SupabaseClient} config={config} onSaved={onSaved}/>)
 fireEvent.click(screen.getByRole('button',{name:'Editar dados da prestadora'}))
 fireEvent.change(screen.getByLabelText('Motivo da alteração'),{target:{value:'Cadastro para lançamento'}})
 return {rpc,onSaved}
}
describe('platform identity editing',()=>{
 it('saves only identity fields with the original concurrency token and leaves optional identity blank',async()=>{
  const {rpc,onSaved}=setup()
  fireEvent.change(screen.getByLabelText('Nome fantasia'),{target:{value:'CorSys V35'}})
  fireEvent.click(screen.getByRole('button',{name:'Salvar dados da prestadora'}))
  await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1))
  expect(rpc).toHaveBeenCalledWith('save_platform_identity',{
   p_identity:{trade_name:'CorSys V35',legal_name:null,tax_id:null,postal_code:null,address_line:null,city:null,state_code:null,billing_email:null,support_email:null,support_phone:null},
   p_expected_updated_at:config.updated_at,p_reason:'Cadastro para lançamento',
  })
 })
 it.each(['42501','PT409'])('blocks further submissions after access/concurrency rejection %s',async code=>{
  const {rpc,onSaved}=setup({data:null,error:{code}})
  fireEvent.click(screen.getByRole('button',{name:'Salvar dados da prestadora'}))
  await screen.findByRole('alert')
  expect(screen.getByRole('button',{name:'Salvar dados da prestadora'})).toBeDisabled()
  expect(onSaved).not.toHaveBeenCalled()
  expect(rpc).toHaveBeenCalledTimes(1)
 })
 it('requires reconciliation after an uncertain response and does not retry on reopening',async()=>{
  const {rpc,onSaved}=setup({data:null,error:null})
  fireEvent.click(screen.getByRole('button',{name:'Salvar dados da prestadora'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('não pôde ser confirmada')
  fireEvent.click(screen.getByRole('button',{name:'Fechar edição'}))
  fireEvent.click(screen.getByRole('button',{name:'Editar dados da prestadora'}))
  expect(screen.getByRole('button',{name:'Salvar dados da prestadora'})).toBeDisabled()
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(onSaved).not.toHaveBeenCalled()
 })
 it('allows correcting a definitive validation error without invoking the saved callback',async()=>{
  const {onSaved}=setup({data:null,error:{code:'22023'}})
  fireEvent.click(screen.getByRole('button',{name:'Salvar dados da prestadora'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Confira o formato')
  expect(screen.getByRole('button',{name:'Salvar dados da prestadora'})).toBeEnabled()
  expect(onSaved).not.toHaveBeenCalled()
 })
})
