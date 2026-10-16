import type { SupabaseClient } from '@supabase/supabase-js'

export type MonthlyRuleSummary = {
 id: string; organization_id: string; name: string; active: boolean; frequency: string
}
export type MonthlyGenerationPreview = {
 organization_id: string; rule_id: string; competence: string; rule_name: string
 ready: boolean; eligible_members: number; to_create: number; exempt: number
 already_generated: number; missing_price: number; accounting_mapping_ready: boolean
 period_closed: boolean; fingerprint: string
}
const month=/^\d{4}-(0[1-9]|1[0-2])$/
const hash=/^[a-f0-9]{64}$/
export function monthStart(monthValue:string){
 if(!month.test(monthValue))throw new Error('Selecione uma competência mensal válida.')
 return monthValue+'-01'
}
export async function loadMonthlyRules(client:SupabaseClient,org:string,signal:AbortSignal){
 const {data,error}=await client.from('recurring_rules')
  .select('id,organization_id,name,active,frequency').eq('organization_id',org)
  .order('name').limit(201).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>200||
  data.some(row=>row.organization_id!==org||typeof row.id!=='string'||
   typeof row.name!=='string'||typeof row.active!=='boolean'||
   typeof row.frequency!=='string'))throw Error('Invalid monthly rules response')
 return data.filter(row=>row.active&&row.frequency==='monthly') as MonthlyRuleSummary[]
}
export function validateMonthlyPreview(
 input:unknown,org:string,rule:string,competence:string,
):MonthlyGenerationPreview{
 const data=input as Partial<MonthlyGenerationPreview>|null
 if(!data||typeof data!=='object'||data.organization_id!==org||
   data.rule_id!==rule||data.competence!==competence||typeof data.rule_name!=='string'||
   typeof data.ready!=='boolean'||typeof data.accounting_mapping_ready!=='boolean'||
   typeof data.period_closed!=='boolean'||typeof data.fingerprint!=='string'||
   !hash.test(data.fingerprint))throw Error('Prévia inválida: escopo ou integridade inesperados.')
 for(const key of ['eligible_members','to_create','exempt','already_generated','missing_price'] as const){
  if(!Number.isSafeInteger(data[key])||data[key]!<0||data[key]!>200)
    throw Error('Prévia inválida: quantidade inesperada.')
 }
 if(data.eligible_members!==data.to_create!+data.exempt!+data.already_generated!+data.missing_price!)
   throw Error('Prévia inválida: totais inconsistentes.')
 if(data.ready&&(!data.accounting_mapping_ready||data.period_closed||data.to_create!<=0))
  throw Error('Prévia inválida: pronta sem condições contábeis.')
 return data as MonthlyGenerationPreview
}
export async function fetchMonthlyPreview(client:SupabaseClient,org:string,rule:string,monthValue:string){
 const competence=monthStart(monthValue)
 const {data,error}=await client.rpc('preview_monthly_charge_generation',{
  p_organization_id:org,p_rule_id:rule,p_competence:competence,
 })
 if(error)throw error
 return validateMonthlyPreview(data,org,rule,competence)
}
