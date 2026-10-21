import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi,it,expect} from 'vitest'
import {AgapeEvents} from './AgapeEvents'
import {loadManualChargeCatalog} from '../lib/manual-charges'
import {loadAgapeEvents,loadAgapeParticipants} from '../lib/agape-events'
vi.mock('../lib/manual-charges',()=>({loadManualChargeCatalog:vi.fn()}))
vi.mock('../lib/agape-events',async original=>({...await original<typeof import('../lib/agape-events')>(),loadAgapeEvents:vi.fn(),loadAgapeParticipants:vi.fn()}))
const org='94b84958-4dd9-435d-9a4e-244220835d70',member='d5842ad6-913d-4a3e-8250-876fb2e2a215',category='df01dcfa-707c-4861-a9fb-719e7ec21f65',id='4d3bc947-25a7-4f80-9652-1d5841cf7e9b'
function fixture(){
 vi.mocked(loadManualChargeCatalog).mockResolvedValue({members:[{id:member,organization_id:org,full_name:'Participante fictício',status:'active'}],categories:[{id:category,organization_id:org,name:'Eventos fictícios',active:true,domain:'member_receivable'}]})
 vi.mocked(loadAgapeEvents).mockResolvedValue({events:[],hasNext:false})
 const rpc=vi.fn<(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:{code?:string}|null}>>(async(name,args)=>({data:name==='preview_agape_event'?{
  organization_id:org,category_id:category,name:'Ágape fictício',event_date:'2026-10-21',due_date:'2026-10-22',default_amount:args?.p_default_amount,
  participant_count:1,charge_count:Number(args?.p_default_amount)>0?1:0,total_amount:args?.p_default_amount,
  participants:[{member_id:member,name:'Participante fictício',amount:args?.p_default_amount}],existing_id:null,ready:true,fingerprint:'a'.repeat(64)}:id,error:null}))
 return {rpc,client:{rpc} as unknown as SupabaseClient}
}
async function fill(amount='1,25'){
 await screen.findByRole('checkbox',{name:'Participante fictício'});fireEvent.click(screen.getByRole('checkbox',{name:'Participante fictício'}))
 fireEvent.change(screen.getByLabelText('Nome do ágape'),{target:{value:'Ágape fictício'}})
 fireEvent.change(screen.getByLabelText('Data do ágape'),{target:{value:'2026-10-21'}})
 fireEvent.change(screen.getByLabelText('Vencimento do ágape'),{target:{value:'2026-10-22'}})
 fireEvent.change(screen.getByLabelText('Valor padrão por participante (R$)'),{target:{value:amount}})
 fireEvent.change(screen.getByLabelText('Categoria do ágape'),{target:{value:category}})
 fireEvent.change(screen.getByLabelText('Justificativa do ágape'),{target:{value:'DEV QA evento autorizado'}})
 fireEvent.click(screen.getByRole('button',{name:'Conferir ágape'}))
}
async function review(amount='1,25'){await fill(amount);await screen.findByRole('heading',{name:'Confira participantes e total'})}
function confirm(){fireEvent.change(screen.getByLabelText('Digite GERAR para registrar o ágape'),{target:{value:'GERAR'}});fireEvent.click(screen.getByRole('button',{name:'Registrar ágape'}))}
it('confirms reviewed participants and amount, then refreshes history without registering payment',async()=>{
 const f=fixture();render(<AgapeEvents client={f.client} organizationId={org}/>);await review()
 expect(screen.getByRole('button',{name:'Registrar ágape'})).toBeDisabled();confirm()
 await screen.findByText('Ágape registrado. Participantes e cobranças podem ser conferidos no histórico.')
 expect(f.rpc).toHaveBeenCalledWith('create_agape_event',expect.objectContaining({p_organization_id:org,p_member_ids:[member],p_default_amount:'1.25',p_expected_fingerprint:'a'.repeat(64),p_idempotency_key:expect.any(String)}))
 expect(f.rpc.mock.calls.filter(([name])=>name==='create_agape_event')).toHaveLength(1)
 expect(f.rpc.mock.calls.some(([name])=>name.includes('payment'))).toBe(false)
 expect(screen.getByRole('checkbox',{name:'Participante fictício'})).not.toBeChecked()
})
it('shows free participation as zero charges and invalidates preview when amount changes',async()=>{
 const f=fixture();render(<AgapeEvents client={f.client} organizationId={org}/>);await review('0')
 expect(screen.getByText(/1 participante\(s\) · 0 cobrança\(s\)/)).toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Valor padrão por participante (R$)'),{target:{value:'2'}})
 expect(screen.queryByRole('button',{name:'Registrar ágape'})).not.toBeInTheDocument()
})
it('refuses a foreign preview and never offers confirmation',async()=>{
 const f=fixture(),original=f.rpc.getMockImplementation()!
 f.rpc.mockImplementation(async(name,args)=>{const r=await original(name,args);return {...r,data:{...r.data as object,organization_id:'foreign'}}})
 render(<AgapeEvents client={f.client} organizationId={org}/>);await fill();await screen.findByRole('alert')
 expect(screen.queryByRole('button',{name:'Registrar ágape'})).not.toBeInTheDocument()
})
it('retains the same command after response loss and unlocks after definitive PT409',async()=>{
 const f=fixture(),original=f.rpc.getMockImplementation()!;let count=0
 f.rpc.mockImplementation(async(name,args)=>name==='preview_agape_event'?original(name,args):++count===1?{data:null,error:{}}:{data:null,error:{code:'PT409'}})
 render(<AgapeEvents client={f.client} organizationId={org}/>);await review();confirm()
 fireEvent.click(await screen.findByRole('button',{name:'Verificar envio do ágape'}));await screen.findByText('O ágape ou os participantes mudaram. Confira o histórico e prepare uma nova prévia.')
 const sent=f.rpc.mock.calls.filter(([name])=>name==='create_agape_event');expect(sent).toHaveLength(2);expect(sent[0][1]).toEqual(sent[1][1])
 await waitFor(()=>expect(screen.getByLabelText('Nome do ágape')).toBeEnabled())
 expect(screen.queryByRole('button',{name:'Verificar envio do ágape'})).not.toBeInTheDocument()
})
it('reads participants and exposes canceled debt separately from free participation',async()=>{
 const f=fixture();vi.mocked(loadAgapeEvents).mockResolvedValue({events:[{id,organization_id:org,name:'Ágape fictício',event_type:'agape',event_date:'2026-10-21',default_amount:1.25}],hasNext:false})
 vi.mocked(loadAgapeParticipants).mockResolvedValue([{member_id:member,charged_amount:1.25,charge_id:id,open:0,canceled:true}])
 render(<AgapeEvents client={f.client} organizationId={org}/>);fireEvent.click(await screen.findByRole('button',{name:'Ver participantes de Ágape fictício'}));await screen.findByText(/Participante fictício · Cobrança cancelada/)
 expect(loadAgapeParticipants).toHaveBeenCalledWith(f.client,org,id,expect.any(AbortSignal))
})
