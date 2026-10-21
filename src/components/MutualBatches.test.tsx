import {fireEvent,render,screen} from '@testing-library/react'
import {it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {MutualBatches} from './MutualBatches'
import {loadManualChargeCatalog} from '../lib/manual-charges'
import {loadMutualBatches} from '../lib/mutual-batches'
vi.mock('../lib/manual-charges',()=>({loadManualChargeCatalog:vi.fn()}))
vi.mock('../lib/mutual-batches',async original=>({...await original<typeof import('../lib/mutual-batches')>(),loadMutualBatches:vi.fn()}))
const org='94b84958-4dd9-435d-9a4e-244220835d70',member='d5842ad6-913d-4a3e-8250-876fb2e2a215',category='df01dcfa-707c-4861-a9fb-719e7ec21f65',id='4d3bc947-25a7-4f80-9652-1d5841cf7e9b'
function fixture(){
 vi.mocked(loadManualChargeCatalog).mockResolvedValue({members:[{id:member,organization_id:org,full_name:'Integrante fictício',status:'active'}],categories:[{id:category,organization_id:org,name:'Mútuas fictícias',active:true,domain:'member_receivable'}]})
 vi.mocked(loadMutualBatches).mockResolvedValue({batches:[],hasNext:false})
 const rpc=vi.fn<(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:{code?:string}|null}>>(async(name,args)=>({data:name==='preview_mutual_batch'?{
  organization_id:org,category_id:category,number_start:710,number_end:711,unit_amount:'1.25',competence:'2026-10-01',issue_date:'2026-10-21',due_date:'2026-10-22',
  assignments:(args?.p_assignments as {mutual_number:number;member_id:string}[]).map(a=>({...a,name:'Integrante fictício',amount:1.25})),charge_count:2,total_amount:2.50,account_nature:'revenue',account_code:'3.1',existing_batch_id:null,ready:true,fingerprint:'a'.repeat(64)}:id,error:null}))
 return {rpc,client:{rpc} as unknown as SupabaseClient}
}
async function fill(){
 await screen.findByRole('option',{name:'Integrante fictício'})
 for(const [label,value] of [['Número inicial','710'],['Número final','711'],['Valor por número (R$)','1,25'],['Competência das mútuas','2026-10'],['Data de emissão das mútuas','2026-10-21'],['Vencimento das mútuas','2026-10-22'],['Categoria das mútuas',category],['Justificativa das mútuas','DEV QA mútuas']])fireEvent.change(screen.getByLabelText(label),{target:{value}})
 fireEvent.change(screen.getByLabelText('Integrante responsável'),{target:{value:member}})
 expect(screen.getByRole('button',{name:'Conferir mútuas'})).toBeDisabled()
 fireEvent.click(screen.getByRole('button',{name:'Atribuir toda a faixa ao integrante escolhido'}))
 fireEvent.click(screen.getByRole('button',{name:'Conferir mútuas'}))
}
async function review(){await fill();await screen.findByRole('heading',{name:'Confira a faixa e os integrantes'})}
function confirm(){fireEvent.change(screen.getByLabelText('Digite GERAR para registrar as mútuas'),{target:{value:'GERAR'}});fireEvent.click(screen.getByRole('button',{name:'Registrar mútuas'}))}
it('requires explicit distribution and reviewed exact total before creating only charges',async()=>{
 const f=fixture();render(<MutualBatches client={f.client} organizationId={org}/>);await review()
 expect(screen.getByText(/Classificação: Receita/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Registrar mútuas'})).toBeDisabled();confirm()
 await screen.findByText('Mútuas registradas. Confira números, integrantes e cobranças no histórico.')
 expect(f.rpc).toHaveBeenCalledWith('create_mutual_batch',expect.objectContaining({p_assignments:[{mutual_number:710,member_id:member},{mutual_number:711,member_id:member}],p_unit_amount:'1.25',p_expected_fingerprint:'a'.repeat(64)}))
 expect(f.rpc.mock.calls.some(([n])=>n.includes('payment'))).toBe(false)
})
it('clears distribution and confirmation after changing range',async()=>{
 const f=fixture();render(<MutualBatches client={f.client} organizationId={org}/>);await review()
 fireEvent.change(screen.getByLabelText('Número final'),{target:{value:'712'}})
 expect(screen.queryByRole('button',{name:'Registrar mútuas'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Conferir mútuas'})).toBeDisabled()
})
it('rejects foreign tenant previews',async()=>{
 const f=fixture(),original=f.rpc.getMockImplementation()!;f.rpc.mockImplementation(async(n,a)=>{const r=await original(n,a);return {...r,data:{...r.data as object,organization_id:'foreign'}}})
 render(<MutualBatches client={f.client} organizationId={org}/>);await fill();await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Registrar mútuas'})).not.toBeInTheDocument()
})
it('keeps the same idempotency key after uncertainty and unlocks on PT409',async()=>{
 const f=fixture(),original=f.rpc.getMockImplementation()!;let count=0
 f.rpc.mockImplementation(async(n,a)=>n==='preview_mutual_batch'?original(n,a):++count===1?{data:null,error:{}}:{data:null,error:{code:'PT409'}})
 render(<MutualBatches client={f.client} organizationId={org}/>);await review();confirm()
 fireEvent.click(await screen.findByRole('button',{name:'Verificar envio das mútuas'}));await screen.findByText('A faixa ou os dados mudaram. Confira o histórico e prepare uma nova prévia.')
 const calls=f.rpc.mock.calls.filter(([n])=>n==='create_mutual_batch');expect(calls).toHaveLength(2);expect(calls[0][1]).toEqual(calls[1][1]);expect(screen.getByLabelText('Número inicial')).toBeEnabled()
})
