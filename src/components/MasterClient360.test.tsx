import {fireEvent,render,screen} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterClient360} from './MasterClient360'
import {validateMasterClient360} from '../lib/master-client-360'
const org='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const value={
 organization_id:org,name:'Loja TESTE',number:'101',status:'active',
 commercial_status:'trialing',customer_since:'2026-01-01',
 billing_email:'teste@example.test',billing_provider:'manual',
 subscription_id:null,subscription_status:'trialing',
 subscription_start:'2026-10-01',subscription_end:'2026-10-31',
 plan_version_id:null,invoices_total:2,invoices_open_amount:'150.00',
 invoices_overdue_amount:'50.00',tickets_total:4,tickets_open:1,
 as_of:'2026-10-10',integrity_ok:true,
}
const tenants=[{organization_id:org,organization_name:'Loja TESTE'}]
function fixture(response:unknown=value,error:unknown=null){
 const rpc=vi.fn().mockResolvedValue({data:response,error})
 return {client:{rpc} as unknown as SupabaseClient,rpc}
}
async function select(){
 fireEvent.change(screen.getByLabelText('Loja cliente'),{target:{value:org}})
 await screen.findByText(/Loja TESTE — nº 101/)
}
describe('Master Client 360 privacy and billing',()=>{
 it('shows only a selected tenant commercial and SaaS support summary',async()=>{
  const {client,rpc}=fixture()
  render(<MasterClient360 client={client} tenants={tenants}/>)
  await select()
  expect(rpc).toHaveBeenCalledWith('read_master_client_360',{p_organization_id:org})
  expect(screen.getByText(/R\$\s?150,00/)).toBeInTheDocument()
  expect(screen.getByText(/R\$\s?50,00/)).toBeInTheDocument()
  expect(screen.getByText(/não a tesouraria institucional/)).toBeInTheDocument()
 })
 it('does not reveal summary on denied Master role or AAL2',async()=>{
  const {client}=fixture(null,{code:'42501'})
  render(<MasterClient360 client={client} tenants={tenants}/>)
  fireEvent.change(screen.getByLabelText('Loja cliente'),{target:{value:org}})
  await screen.findByText('Esta consulta exige MASTER com MFA ativo.')
  expect(screen.queryByText('Loja TESTE — nº 101')).not.toBeInTheDocument()
 })
 it('rejects wrong tenant or out-of-range amounts and broken integrity',()=>{
  expect(()=>validateMasterClient360({...value,organization_id:'wrong'},org)).toThrow()
  expect(()=>validateMasterClient360({...value,invoices_overdue_amount:'200.00'},org)).toThrow()
  expect(()=>validateMasterClient360({...value,tickets_open:5},org)).toThrow()
  expect(()=>validateMasterClient360({...value,integrity_ok:false},org)).toThrow()
 })
 it('does not preserve previous customer data when choosing another org',async()=>{
  const other='559ba052-c408-4418-b806-0c0c4b8e3603'
  const {client,rpc}=fixture()
  rpc.mockImplementation((_:string,args:{p_organization_id:string})=>Promise.resolve({
   data:{...value,organization_id:args.p_organization_id,name:args.p_organization_id===org?'Loja TESTE':'Outra Loja'},error:null,
  }))
  render(<MasterClient360 client={client} tenants={[...tenants,{organization_id:other,organization_name:'Outra Loja'}]}/>)
  await select()
  fireEvent.change(screen.getByLabelText('Loja cliente'),{target:{value:other}})
  await screen.findByText(/Outra Loja — nº 101/)
  expect(screen.queryByText('Loja TESTE — nº 101')).not.toBeInTheDocument()
 })
})
