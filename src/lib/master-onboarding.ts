import type {SupabaseClient} from '@supabase/supabase-js'

export type OnboardingDraft = {
 id:string;status:string;current_step:string;organization_id:string|null;
 prospective_name:string|null;organization_number:string|null;
 city:string|null;state_code:string|null;admin_name:string|null;
 admin_email:string|null;billing_email:string|null;
 plan_version_id:string|null;contract_price:string|number|null;
 subscription_start:string|null;trial_days:number|null;tenant_slug:string|null;
 invite_email:string|null;terms_acceptance_required:boolean
}
export type OnboardingPlan = {
 id:string;plan_id:string;status:string;price:string|number;
 currency:string;billing_interval:string;valid_from:string;valid_to:string|null;
 display_name_snapshot:string|null;version_number:number
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const money=/^\d{1,12}(\.\d{1,2})?$/
export async function loadMasterOnboarding(client:SupabaseClient,signal:AbortSignal){
 const [runs,plans]=await Promise.all([
  client.from('saas_onboarding_runs')
   .select('id,status,current_step,organization_id,prospective_name,organization_number,city,state_code,admin_name,admin_email,billing_email,plan_version_id,contract_price,subscription_start,trial_days,tenant_slug,invite_email,terms_acceptance_required')
   .order('created_at',{ascending:false}).limit(101).abortSignal(signal),
  client.from('saas_plan_versions')
   .select('id,plan_id,status,price,currency,billing_interval,valid_from,valid_to,display_name_snapshot,version_number')
   .eq('status','published').order('valid_from',{ascending:false})
   .limit(101).abortSignal(signal),
 ])
 if(runs.error)throw runs.error
 if(plans.error)throw plans.error
 if(!Array.isArray(runs.data)||!Array.isArray(plans.data)||runs.data.length>100||plans.data.length>100)
  throw Error('Master onboarding data not complete')
 for(const r of runs.data as OnboardingDraft[]){
  if(!r||!uuid.test(r.id)||typeof r.status!=='string'||typeof r.current_step!=='string'||
   (r.organization_id!==null&&!uuid.test(r.organization_id)))throw Error('Invalid onboarding data')
 }
 for(const p of plans.data as OnboardingPlan[]){
  if(!p||!uuid.test(p.id)||p.status!=='published'||!money.test(String(p.price))||
   !/^\d{4}-\d{2}-\d{2}$/.test(p.valid_from))throw Error('Invalid Master plan version')
 }
 return {runs:runs.data as OnboardingDraft[],plans:plans.data as OnboardingPlan[]}
}
export function validateOnboardingDraft(input:{
 name:string;number:string;adminName:string;adminEmail:string;
 billingEmail:string;planId:string;price:string;start:string;trialDays:number;
 city:string;state:string;tenantSlug:string;inviteEmail:string
},plans:OnboardingPlan[]){
 const data={...input,
 name:input.name.trim(),number:input.number.trim(),adminName:input.adminName.trim(),
 adminEmail:input.adminEmail.trim(),billingEmail:input.billingEmail.trim(),
 city:input.city.trim(),state:input.state.trim().toUpperCase(),
 tenantSlug:input.tenantSlug.trim().toLowerCase(),inviteEmail:input.inviteEmail.trim(),
 }
 const plan=plans.find(p=>p.id===data.planId&&p.status==='published')
 const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
 if(!plan||data.name.length<3||data.name.length>180||
  data.number.length<1||data.number.length>40||
  data.adminName.length<3||data.adminName.length>140||
  !email.test(data.adminEmail)||!email.test(data.billingEmail)||!email.test(data.inviteEmail)||
  !money.test(data.price)||Number(data.price)<0||
  !/^\d{4}-\d{2}-\d{2}$/.test(data.start)||data.start<plan.valid_from||
  (plan.valid_to!==null&&data.start>plan.valid_to)||
  !Number.isSafeInteger(data.trialDays)||data.trialDays<0||data.trialDays>365||
  !/^[a-z0-9][a-z0-9-]{2,60}$/.test(data.tenantSlug)||
  (data.city.length>0&&data.city.length>140)||
  (data.state.length>0&&!/^[A-Z]{2}$/.test(data.state))
 )throw Error('Revise os dados da Loja, e-mails, plano publicado, vigência e identificação.')
 return data
}
