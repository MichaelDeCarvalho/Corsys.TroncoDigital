import {useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {OnboardingDraft} from '../lib/master-onboarding'

export function OnboardingInviteSender({client,runs}:{client:SupabaseClient;runs:OnboardingDraft[]}){
 const guard=useRef(false)
 const [locked,setLocked]=useState<string[]>([]),[pending,setPending]=useState(''),[message,setMessage]=useState('')
 async function send(id:string){
  if(guard.current||locked.includes(id))return
  guard.current=true;setPending(id);setLocked(v=>[...v,id]);setMessage('')
  try{
   const {data,error}=await client.functions.invoke('onboarding-invite?run_id='+encodeURIComponent(id),{body:{}})
   setMessage(!error&&data?.outcome==='auth_accepted'
    ? 'Convite aceito pelo serviço de e-mail. A entrega e o aceite do destinatário ainda precisam ser confirmados.'
    : 'Envio não confirmado. Consulte a fila e reconcilie o resultado antes de tentar novamente.')
  }catch{setMessage('Envio não confirmado. Consulte a fila e reconcilie o resultado antes de tentar novamente.')}
  finally{guard.current=false;setPending('')}
 }
 const invitations=runs.filter(r=>r.status==='awaiting_invite'&&r.current_step==='invite'&&r.organization_id)
 if(!invitations.length)return null
 return <section aria-label="Convites de implantação">
  <h4>Convites pendentes de ativação</h4>
  <p>Enviar usa autorização Master/MFA e a reserva única da fila. Aceitação pelo serviço de e-mail não comprova entrega nem ativação. Respostas incertas exigem reconciliação.</p>
  {message&&<p role="status">{message}</p>}
  {invitations.map(r=><div className="panel" key={r.id}>
   <p>{r.prospective_name} — {r.invite_email}</p>
   <button type="button" disabled={Boolean(pending)||locked.includes(r.id)} onClick={()=>void send(r.id)}>
    {pending===r.id?'Enviando convite…':locked.includes(r.id)?'Envio solicitado — consultar fila':'Enviar convite para '+r.prospective_name}
   </button>
  </div>)}
 </section>
}
