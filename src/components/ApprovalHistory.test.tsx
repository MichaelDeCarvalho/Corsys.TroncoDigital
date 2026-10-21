import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi,it,expect} from 'vitest'
import {ApprovalHistory} from './ApprovalHistory'
const request='faaf76e4-d796-430f-929f-71df5beaf832',payable='559ba052-c408-4418-b806-0c0c4b8e3603',actor='a752dda8-4ef0-4c58-9d3b-b8fee14ec624',other='d5842ad6-913d-4a3e-8250-876fb2e2a215'
const baseRequest={id:request,organization_id:'org',payable_id:payable,correction_id:null,minimum_approvers:2,amount_snapshot:10,created_at:'2026-10-21T12:00:00Z'}
const vote={id:actor,organization_id:'org',approval_request_id:request,actor_user_id:actor,decision:'approve',reason:'Conferido pelo primeiro aprovador',created_at:'2026-10-21T13:00:00Z'}
function fixture(requests:unknown[]=[baseRequest],votes:unknown[]=[vote]){
 const from=vi.fn((table:string)=>{
  const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,range:()=>q,abortSignal:()=>Promise.resolve({data:table==='payable_approval_requests'?requests:votes,error:null})};return q
 });return {client:{from} as unknown as SupabaseClient,from}
}
it('keeps one approval pending and reports the stored minimum of two',async()=>{
 const f=fixture();render(<ApprovalHistory client={f.client} organizationId="org"/>);
 fireEvent.click(await screen.findByRole('button',{name:/Ver decisões da solicitação/}));await screen.findByText(/Pendente · 1\/2 aprovações/)
 expect(screen.getByText(/Conferido pelo primeiro aprovador/)).toBeInTheDocument()
})
it('preserves a historical rejection from a second distinct actor',async()=>{
 const f=fixture(undefined,[vote,{...vote,id:other,actor_user_id:other,decision:'reject',reason:'Rejeitado pelo segundo aprovador'}]);render(<ApprovalHistory client={f.client} organizationId="org"/>);
 fireEvent.click(await screen.findByRole('button',{name:/Ver decisões da solicitação/}));await screen.findByText(/Rejeitada · 1\/2 aprovações · 1 rejeição/)
})
it('reports approval only after two distinct approvers',async()=>{
 const f=fixture(undefined,[vote,{...vote,id:other,actor_user_id:other,reason:'Conferido pelo segundo aprovador'}]);render(<ApprovalHistory client={f.client} organizationId="org"/>);
 fireEvent.click(await screen.findByRole('button',{name:/Ver decisões da solicitação/}));await screen.findByText(/Aprovada · 2\/2 aprovações/)
})
it('fails closed for a duplicate voter or a foreign request',async()=>{
 const f=fixture(undefined,[vote,{...vote,id:other}]);const view=render(<ApprovalHistory client={f.client} organizationId="org"/>);
 fireEvent.click(await screen.findByRole('button',{name:/Ver decisões da solicitação/}));await screen.findByText(/Decisões incompletas ou inconsistentes/)
 expect(screen.queryByText(/Aprovada ·/)).not.toBeInTheDocument();view.unmount()
 render(<ApprovalHistory client={fixture([{...baseRequest,organization_id:'foreign'}]).client} organizationId="org"/>);
 await screen.findByText('Não foi possível conferir o histórico de aprovações desta Loja.')
 expect(screen.queryByRole('button',{name:/Ver decisões da solicitação/})).not.toBeInTheDocument()
})
it('paginates requests without presenting the extra sentinel row',async()=>{
 const requests=Array.from({length:21},(_,i)=>({...baseRequest,id:`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`})),f=fixture(requests)
 render(<ApprovalHistory client={f.client} organizationId="org"/>);await screen.findAllByRole('button',{name:/Ver decisões da solicitação/})
 expect(screen.getAllByRole('button',{name:/Ver decisões da solicitação/})).toHaveLength(20)
 fireEvent.click(screen.getByRole('button',{name:'Próxima página do histórico'}));await waitFor(()=>expect(screen.getByText('Página 2')).toBeInTheDocument())
})
