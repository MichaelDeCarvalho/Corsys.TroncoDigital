import {useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {PlatformConfiguration} from '../lib/master-config'

const fields=[
 ['trade_name','Nome fantasia'],['legal_name','Razão social'],['tax_id','CNPJ'],
 ['postal_code','CEP'],['address_line','Endereço'],['city','Cidade'],['state_code','UF'],
 ['billing_email','E-mail financeiro'],['support_email','E-mail de suporte'],['support_phone','Telefone / WhatsApp de suporte'],
] as const

export function PlatformIdentityEditor({client,config,onSaved}:{client:SupabaseClient;config:PlatformConfiguration;onSaved:()=>void}){
 const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState('')
 const guard=useRef(false)
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(guard.current||blocked)return
  guard.current=true;setBusy(true);setError('')
  const data=new FormData(event.currentTarget)
  const identity=Object.fromEntries(fields.map(([key])=>[key,String(data.get(key)??'').trim()||null]))
  try{
   const result=await client.rpc('save_platform_identity',{
    p_identity:identity,p_expected_updated_at:config.updated_at,p_reason:String(data.get('reason')??'').trim(),
   })
   if(result.error)throw result.error
   if(typeof result.data!=='string'||!Number.isFinite(Date.parse(result.data)))throw Error('Unconfirmed save')
   onSaved()
  }catch(cause){
   const code=(cause as {code?:string})?.code
   if(code==='22023')setError('Confira o formato dos campos e o motivo informado.')
   else if(code==='42501'||code==='28000'){setBlocked(true);setError('A gravação exige MASTER e autenticação em dois fatores. Atualize para validar seu acesso.')}
   else if(code==='PT409'){setBlocked(true);setError('Os dados foram alterados por outra operação. Atualize a configuração antes de editar novamente.')}
   else {setBlocked(true);setError('A gravação não pôde ser confirmada. Atualize e confira os dados antes de uma nova tentativa.')}
  }finally{guard.current=false;setBusy(false)}
 }
 if(!editing)return <button type="button" className="secondary" onClick={()=>setEditing(true)}>Editar dados da prestadora</button>
 return <form aria-label="Editar dados da prestadora" onSubmit={submit}>
  <p className="subtle">Os dados reais podem ser preenchidos ao final da implantação. Alterações atualizam o cadastro e preservam documentos já emitidos.</p>
  {error&&<p role="alert" className="message error">{error}</p>}
  <fieldset disabled={busy||blocked}>
   <legend>Dados da prestadora</legend>
   <div className="member-form-grid">{fields.map(([key,label])=><label key={key}>
    {label}<input name={key} defaultValue={config[key]??''} maxLength={240} required={key==='trade_name'} type={key.endsWith('_email')?'email':'text'}/>
   </label>)}</div>
   <label>Motivo da alteração<input name="reason" required minLength={3} maxLength={500}/></label>
   <button type="submit" className="primary">{busy?'Salvando…':'Salvar dados da prestadora'}</button>
  </fieldset>
  <button type="button" className="secondary" disabled={busy} onClick={()=>{setEditing(false);setError('')}}>Fechar edição</button>
 </form>
}
