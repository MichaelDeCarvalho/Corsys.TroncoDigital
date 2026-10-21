import type {SupabaseClient} from '@supabase/supabase-js'
import {agreementCents,agreementUUID} from './member-agreements'
export type MutualAssignment={mutual_number:number;member_id:string}
export type MutualInput={p_organization_id:string;p_category_id:string;p_number_start:number;p_number_end:number;p_unit_amount:string;p_competence:string;p_issue_date:string;p_due_date:string;p_assignments:MutualAssignment[]}
export const mutualNatures:Record<string,string>={revenue:'Receita',cost:'Custo',expense:'Despesa',financial_result:'Resultado financeiro',patrimonial:'Patrimonial — fora da DRE'}
export type MutualPreview={organization_id:string;category_id:string;number_start:number;number_end:number;unit_amount:string|number;competence:string;issue_date:string;due_date:string;
 assignments:{mutual_number:number;member_id:string;name:string;amount:string|number}[];charge_count:number;total_amount:string|number;account_nature:string;account_code:string;existing_batch_id:string|null;ready:boolean;fingerprint:string}
export function mutualNumbers(start:string,end:string){
 if(!/^\d{1,10}$/.test(start)||!/^\d{1,10}$/.test(end))return []
 const a=Number(start),b=Number(end)
 if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<1||b>2147483647||b<a||b-a+1>200)return []
 return Array.from({length:b-a+1},(_,i)=>a+i)
}
export async function previewMutualBatch(client:SupabaseClient,input:MutualInput){
 const r=await client.rpc('preview_mutual_batch',input);if(r.error)throw r.error
 const v=r.data as MutualPreview|null,n=input.p_number_end-input.p_number_start+1,cents=agreementCents(input.p_unit_amount)
 if(!v||n<1||n>200||!Number.isSafeInteger(cents*n)||v.organization_id!==input.p_organization_id||v.category_id!==input.p_category_id||
  v.number_start!==input.p_number_start||v.number_end!==input.p_number_end||agreementCents(v.unit_amount)!==cents||v.competence!==input.p_competence||
  v.issue_date!==input.p_issue_date||v.due_date!==input.p_due_date||v.charge_count!==n||agreementCents(v.total_amount)!==cents*n||
  !mutualNatures[v.account_nature]||typeof v.account_code!=='string'||!v.account_code||
  !Array.isArray(v.assignments)||v.assignments.length!==n||v.assignments.some((x,i)=>x.mutual_number!==input.p_number_start+i||typeof x.name!=='string'||
   !input.p_assignments.some(a=>a.mutual_number===x.mutual_number&&a.member_id===x.member_id)||agreementCents(x.amount)!==cents)||
  (v.existing_batch_id!==null&&!agreementUUID.test(v.existing_batch_id))||v.ready!==(v.existing_batch_id===null)||!/^[a-f0-9]{64}$/.test(v.fingerprint))throw Error('Mutual preview integrity failure')
 return v
}
export type MutualBatch={id:string;organization_id:string;number_start:number;number_end:number;unit_amount:string|number;competence:string;notes:string|null}
export async function loadMutualBatches(client:SupabaseClient,org:string,page:number,signal:AbortSignal){
 const r=await client.from('mutual_batches').select('id,organization_id,number_start,number_end,unit_amount,competence,notes')
  .eq('organization_id',org).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+20).abortSignal(signal)
 if(r.error)throw r.error
 if(!Array.isArray(r.data)||r.data.length>21||r.data.some(x=>x.organization_id!==org||!agreementUUID.test(x.id)||
  !Number.isSafeInteger(x.number_start)||!Number.isSafeInteger(x.number_end)||!mutualNumbers(String(x.number_start),String(x.number_end)).length||
  agreementCents(x.unit_amount)<=0||!/^\d{4}-\d{2}-01$/.test(x.competence)||(x.notes!==null&&typeof x.notes!=='string')))throw Error('Invalid mutual history')
 return {batches:r.data.slice(0,20) as MutualBatch[],hasNext:r.data.length>20}
}
export type MutualDetail={mutual_number:number;member_id:string;charge_id:string;open:number;canceled:boolean}
export async function loadMutualAssignments(client:SupabaseClient,org:string,batch:MutualBatch,signal:AbortSignal):Promise<MutualDetail[]>{
 const r=await client.from('mutual_assignments').select('organization_id,mutual_batch_id,mutual_number,member_id,charge_id')
  .eq('organization_id',org).eq('mutual_batch_id',batch.id).order('mutual_number').limit(201).abortSignal(signal)
 if(r.error)throw r.error
 const n=batch.number_end-batch.number_start+1
 if(!Array.isArray(r.data)||r.data.length!==n||n<1||n>200||new Set(r.data.map(x=>x.charge_id)).size!==n||
  r.data.some((x,i)=>x.organization_id!==org||x.mutual_batch_id!==batch.id||x.mutual_number!==batch.number_start+i||!agreementUUID.test(x.member_id)||!agreementUUID.test(x.charge_id)))throw Error('Invalid mutual assignments')
 const charges=await client.from('v_charge_balances').select('charge_id,organization_id,member_id,original_amount,open_amount,is_cancelled,integrity_ok')
  .eq('organization_id',org).in('charge_id',r.data.map(x=>x.charge_id)).limit(201).abortSignal(signal)
 if(charges.error)throw charges.error
 if(!Array.isArray(charges.data)||charges.data.length!==n||new Set(charges.data.map(x=>x.charge_id)).size!==n||
  charges.data.some(x=>x.organization_id!==org||!r.data.some(a=>a.charge_id===x.charge_id&&a.member_id===x.member_id)||x.integrity_ok!==true||typeof x.is_cancelled!=='boolean'||
   agreementCents(x.original_amount)!==agreementCents(batch.unit_amount)||agreementCents(x.open_amount)<0))throw Error('Mutual balances inconsistent')
 return r.data.map(x=>{const c=charges.data.find(y=>y.charge_id===x.charge_id)!;return {mutual_number:x.mutual_number,member_id:x.member_id,charge_id:x.charge_id,open:agreementCents(c.open_amount)/100,canceled:c.is_cancelled}})
}
