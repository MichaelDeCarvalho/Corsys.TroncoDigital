import type {SupabaseClient} from '@supabase/supabase-js'
import {exactPaymentAmount} from './member-payments'
export type AgreementInput={p_organization_id:string;p_member_id:string;p_charge_ids:string[];p_amount:string;p_installment_count:number;p_agreement_date:string;p_first_due:string}
export type AgreementPreview={organization_id:string;member_id:string;original_amount:string|number;negotiated_amount:string|number;
 installment_count:number;agreement_date:string;first_due:string;fingerprint:string;
 items:{charge_id:string;open:string|number}[];installments:{number:number;due_date:string;amount:string|number}[]}
export const agreementUUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export function agreementCents(value:unknown){
 if(typeof value!=='number'&&typeof value!=='string')throw Error('Invalid agreement amount')
 const exact=exactPaymentAmount(value),[whole,part='']=exact.split('.')
 const cents=Number(whole)*100+Number(part.padEnd(2,'0'))
 if(!Number.isSafeInteger(cents)||cents<0)throw Error('Invalid agreement cents')
 return cents
}
export function validateAgreementPreview(value:unknown,input:AgreementInput):AgreementPreview{
 const v=value as AgreementPreview|null
 if(!v||v.organization_id!==input.p_organization_id||v.member_id!==input.p_member_id||
  v.installment_count!==input.p_installment_count||v.agreement_date!==input.p_agreement_date||v.first_due!==input.p_first_due||
  !/^[a-f0-9]{64}$/.test(v.fingerprint)||!Array.isArray(v.items)||!Array.isArray(v.installments)||
  v.items.length!==input.p_charge_ids.length||v.installments.length!==input.p_installment_count||
  new Set(v.items.map(x=>x.charge_id)).size!==v.items.length||
  v.items.some(x=>!input.p_charge_ids.includes(x.charge_id)||agreementCents(x.open)<=0)||
  v.installments.some((x,i)=>x.number!==i+1||!/^\d{4}-\d{2}-\d{2}$/.test(x.due_date)||
   x.due_date<input.p_first_due||(i>0&&x.due_date<=v.installments[i-1].due_date)||agreementCents(x.amount)<=0)||
  v.installments[0]?.due_date!==input.p_first_due||
  agreementCents(v.negotiated_amount)!==agreementCents(input.p_amount)||
  agreementCents(v.original_amount)<agreementCents(v.negotiated_amount)||
  v.items.reduce((s,x)=>s+agreementCents(x.open),0)!==agreementCents(v.original_amount)||
  v.installments.reduce((s,x)=>s+agreementCents(x.amount),0)!==agreementCents(v.negotiated_amount))
  throw Error('Agreement preview integrity failure')
 return v
}
export async function previewMemberAgreement(client:SupabaseClient,input:AgreementInput){
 const r=await client.rpc('preview_member_debt_agreement',input)
 if(r.error)throw r.error
 return validateAgreementPreview(r.data,input)
}
export type AgreementRecord={id:string;organization_id:string;member_id:string;agreement_date:string;original_amount:string|number;negotiated_amount:string|number;installment_count:number;reason:string}
export async function loadMemberAgreements(client:SupabaseClient,org:string,member:string,signal:AbortSignal){
 const r=await client.from('member_debt_agreements').select('id,organization_id,member_id,agreement_date,original_amount,negotiated_amount,installment_count,reason')
  .eq('organization_id',org).eq('member_id',member).order('created_at',{ascending:false}).limit(51).abortSignal(signal)
 if(r.error)throw r.error
 if(!Array.isArray(r.data)||r.data.length>50||r.data.some(x=>x.organization_id!==org||x.member_id!==member||
  !agreementUUID.test(x.id)||!Number.isInteger(x.installment_count)||x.installment_count<1||typeof x.reason!=='string'||
  agreementCents(x.negotiated_amount)<=0||agreementCents(x.original_amount)<agreementCents(x.negotiated_amount)))throw Error('Agreement history invalid')
 return r.data as AgreementRecord[]
}
export async function loadAgreementInstallments(client:SupabaseClient,org:string,agreement:AgreementRecord,signal:AbortSignal){
 const r=await client.from('member_debt_agreement_installments').select('organization_id,agreement_id,installment_number,charge_id,due_date,amount')
  .eq('organization_id',org).eq('agreement_id',agreement.id).order('installment_number').limit(25).abortSignal(signal)
 if(r.error)throw r.error
 if(!Array.isArray(r.data)||r.data.length!==agreement.installment_count||r.data.some((x,i)=>x.organization_id!==org||x.agreement_id!==agreement.id||x.installment_number!==i+1||!agreementUUID.test(x.charge_id)||agreementCents(x.amount)<=0)||
  r.data.reduce((s,x)=>s+agreementCents(x.amount),0)!==agreementCents(agreement.negotiated_amount))throw Error('Agreement installments invalid')
 return r.data as {installment_number:number;charge_id:string;due_date:string;amount:string|number}[]
}
