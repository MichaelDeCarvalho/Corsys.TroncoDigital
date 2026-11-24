import type {SupabaseClient} from '@supabase/supabase-js'
export type PlatformPlanVersion={
 plan_id:string;plan_active:boolean;plan_version_id:string;version_number:number;
 display_name_snapshot:string;internal_code_snapshot:string;price:string|number;
 currency:string;billing_interval:string;trial_days:number;grace_days:number;
 valid_from:string;valid_to:string|null;publication_status:string;admin_status:string;
 can_delete_plan:boolean;delete_block_reason:string|null
}
export type PlatformPromotion={
 promotion_series_id:string;latest_promotion_id:string;version_number:number;
 name:string;public_code:string;active:boolean;latest_version_status:string;
 valid_from:string|null;valid_to:string|null;redemption_count:number|string;
 can_delete:boolean;delete_block_reason:string|null
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const money=/^\d{1,12}(\.\d{1,2})?$/
export async function loadPlatformCommercialCatalog(client:SupabaseClient,signal:AbortSignal){
 const [plans,promotions]=await Promise.all([
  client.from('v_saas_plan_version_admin')
   .select('plan_id,plan_active,plan_version_id,version_number,display_name_snapshot,internal_code_snapshot,price,currency,billing_interval,trial_days,grace_days,valid_from,valid_to,publication_status,admin_status,can_delete_plan,delete_block_reason')
   .order('display_name_snapshot').limit(201).abortSignal(signal),
  client.from('v_saas_promotion_series_admin')
   .select('promotion_series_id,latest_promotion_id,version_number,name,public_code,active,latest_version_status,valid_from,valid_to,redemption_count,can_delete,delete_block_reason')
   .order('name').limit(201).abortSignal(signal),
 ])
 if(plans.error)throw plans.error
 if(promotions.error)throw promotions.error
 if(!Array.isArray(plans.data)||!Array.isArray(promotions.data)||
  plans.data.length>200||promotions.data.length>200)
  throw Error('Master commercial catalog incomplete')
 const planIds=new Set<string>(),promotionIds=new Set<string>()
 for(const row of plans.data as PlatformPlanVersion[]){
  if(!uuid.test(row.plan_id)||!uuid.test(row.plan_version_id)||
   planIds.has(row.plan_version_id)||typeof row.plan_active!=='boolean'||
   !Number.isSafeInteger(row.version_number)||row.version_number<1||
   typeof row.display_name_snapshot!=='string'||typeof row.internal_code_snapshot!=='string'||
   typeof row.currency!=='string'||typeof row.billing_interval!=='string'||
   typeof row.publication_status!=='string'||typeof row.admin_status!=='string'||
   !money.test(String(row.price))||!Number.isFinite(Number(row.price))||
   !Number.isSafeInteger(row.trial_days)||!Number.isSafeInteger(row.grace_days)||
   typeof row.can_delete_plan!=='boolean')
   throw Error('Untrusted Master plan data')
  planIds.add(row.plan_version_id)
 }
 for(const row of promotions.data as PlatformPromotion[]){
  if(!uuid.test(row.promotion_series_id)||!uuid.test(row.latest_promotion_id)||
   promotionIds.has(row.promotion_series_id)||
   !Number.isSafeInteger(row.version_number)||row.version_number<1||
   typeof row.name!=='string'||typeof row.public_code!=='string'||
   typeof row.active!=='boolean'||typeof row.latest_version_status!=='string'||
   !Number.isSafeInteger(Number(row.redemption_count))||Number(row.redemption_count)<0||
   typeof row.can_delete!=='boolean')throw Error('Untrusted promotion data')
  promotionIds.add(row.promotion_series_id)
 }
 return {plans:plans.data as PlatformPlanVersion[],promotions:promotions.data as PlatformPromotion[]}
}

export function formatBillingInterval(interval:string):string{
 if(interval==='monthly')return 'Mensal'
 if(interval==='yearly')return 'Anual'
 if(interval==='custom')return 'Personalizada'
 return 'Periodicidade não reconhecida'
}

export function resolveEffectivePlanStatus(plan:Pick<PlatformPlanVersion,'plan_active'|'admin_status'>):string{
 return plan.plan_active?plan.admin_status:'inactive'
}

export function formatPlanAdminStatus(plan:Pick<PlatformPlanVersion,'plan_active'|'admin_status'>):string{
 const status=resolveEffectivePlanStatus(plan)
 if(status==='current')return 'Vigente para novas contratações'
 if(status==='future')return 'Publicada futura'
 if(status==='historical')return 'Histórica / contratos existentes'
 if(status==='draft')return 'Rascunho'
 if(status==='inactive')return 'Plano desativado'
 return 'Situação não reconhecida'
}

export function formatPlanPublicationStatus(status:string):string{
 if(status==='draft')return 'Rascunho'
 if(status==='published')return 'Publicada'
 return 'Publicação não reconhecida'
}

export function formatPlanDeleteBlockReason(canDelete:boolean,reason:string|null):string{
 if(canDelete)return 'Exclusão permitida (sem vínculos)'
 if(reason==='published_version_exists'||reason==='published')return 'Exclusão bloqueada: possui versão publicada'
 if(reason==='subscription_exists')return 'Exclusão bloqueada: possui assinatura vinculada'
 if(reason==='onboarding_link_exists')return 'Exclusão bloqueada: possui onboarding vinculado'
 if(reason==='promotion_link_exists')return 'Exclusão bloqueada: possui oferta vinculada'
 if(reason==='scheduled_change_exists')return 'Exclusão bloqueada: possui mudança agendada'
 return 'Exclusão bloqueada por vínculo contratual'
}

export function formatPromotionStatus(promotion:Pick<PlatformPromotion,'active'|'latest_version_status'>):string{
 if(!promotion.active)return 'Inativa'
 if(promotion.latest_version_status==='published')return 'Publicada'
 if(promotion.latest_version_status==='draft')return 'Rascunho'
 if(promotion.latest_version_status==='retired')return 'Encerrada'
 return 'Status não reconhecido'
}

export function formatPromotionValidity(validFrom:string|null,validTo:string|null):string{
 if(!validFrom)return 'Vigência não informada'
 const from=validFrom.slice(0,10)
 const to=validTo?validTo.slice(0,10):null
 return to?`${from} a ${to}`:`${from} em diante`
}

export function formatPromotionDeleteBlockReason(canDelete:boolean,reason:string|null):string{
 if(canDelete)return 'Exclusão permitida (sem uso)'
 if(reason==='published_history_exists')return 'Exclusão bloqueada: possui histórico publicado'
 if(reason==='redemption_exists'||reason==='used')return 'Exclusão bloqueada: possui resgates registrados'
 if(reason==='customer_link_exists')return 'Exclusão bloqueada: possui clientes vinculados'
 if(reason==='invoice_adjustment_exists')return 'Exclusão bloqueada: possui ajuste em fatura'
 return 'Exclusão bloqueada por vínculo comercial'
}
