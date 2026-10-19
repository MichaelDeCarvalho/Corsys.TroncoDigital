import type {SupabaseClient} from '@supabase/supabase-js'
import {exactPaymentAmount} from './member-payments'
import {validMovementDate} from './institutional-reversals'
export type InstitutionalMonthlyRule={id:string;organization_id:string;direction:'payable'|'receivable';category_id:string;name:string;counterparty_name:string|null;frequency:'monthly'|'annual';due_day:number;active:boolean}
export type MonthlyInstitutionalCategory={id:string;organization_id:string;name:string;domain:string;active:boolean}
export type InstitutionalMonthlyCatalog={rules:InstitutionalMonthlyRule[];categories:MonthlyInstitutionalCategory[]}
export type InstitutionalMonthlyPreview={organization_id:string;rule_id:string;competence:string;direction:'payable'|'receivable';name:string;ready:boolean;amount:string|number|null;due_date:string;active:boolean;period_closed:boolean;version_id:string|null;existing_id:string|null;fingerprint:string;accounting_account_id:string|null;annual_month?:number}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function scoped(r:{data:unknown;error:unknown},org:string){
 if(r.error)throw r.error
 if(!Array.isArray(r.data)||r.data.length>150)throw Error('Incomplete institutional monthly catalog')
 const ids=new Set<string>()
 for(const row of r.data){
  if(!row||typeof row!=='object'||row.organization_id!==org||typeof row.id!=='string'||!uuid.test(row.id)||ids.has(row.id))throw Error('Invalid institutional monthly scope or ID')
  ids.add(row.id)
 }
 return r.data
}
export async function loadInstitutionalMonthlyCatalog(c:SupabaseClient,org:string,signal:AbortSignal):Promise<InstitutionalMonthlyCatalog>{
 const [r,cat]=await Promise.all([
  c.from('institutional_recurring_rules').select('id,organization_id,direction,category_id,name,counterparty_name,frequency,due_day,active')
   .eq('organization_id',org).in('frequency',['monthly','annual']).order('name').limit(151).abortSignal(signal),
  c.from('financial_categories').select('id,organization_id,name,domain,active').eq('organization_id',org).eq('active',true)
   .in('domain',['institutional_expense','institutional_revenue']).order('name').limit(151).abortSignal(signal),
 ])
 const rules=scoped(r,org),categories=scoped(cat,org)
 if(rules.some(x=>!['payable','receivable'].includes(x.direction)||!['monthly','annual'].includes(x.frequency)||typeof x.active!=='boolean'
  ||!Number.isInteger(x.due_day)||x.due_day<1||x.due_day>31||typeof x.category_id!=='string'||!uuid.test(x.category_id)
  ||typeof x.name!=='string'||!x.name.trim()||(x.counterparty_name!==null&&(typeof x.counterparty_name!=='string'||!x.counterparty_name.trim()))))throw Error('Invalid monthly institutional rule')
 if(categories.some(x=>x.active!==true||typeof x.name!=='string'||!x.name.trim()||!['institutional_expense','institutional_revenue'].includes(x.domain)))throw Error('Invalid institutional category')
 return {rules,categories}
}
export async function previewInstitutionalMonthly(c:SupabaseClient,org:string,rule:InstitutionalMonthlyRule,competence:string):Promise<InstitutionalMonthlyPreview>{
 const {data:p,error}=await c.rpc(`preview_institutional_${rule.frequency}_generation`,{p_organization_id:org,p_rule_id:rule.id,p_competence:competence})
 if(error)throw error
 const optionalID=(v:unknown)=>v===null||(typeof v==='string'&&uuid.test(v))
 if(!p||Array.isArray(p)||typeof p!=='object'||p.organization_id!==org||p.rule_id!==rule.id||p.competence!==competence
  ||p.name!==rule.name||p.direction!==rule.direction||p.category_id!==rule.category_id||p.counterparty!==rule.counterparty_name||p.frequency!==rule.frequency
  ||typeof p.ready!=='boolean'||typeof p.active!=='boolean'||typeof p.period_closed!=='boolean'||typeof p.category_active!=='boolean'
  ||typeof p.due_date!=='string'||!validMovementDate(p.due_date)||p.due_date.slice(0,7)!==competence.slice(0,7)
  ||typeof p.fingerprint!=='string'||!/^[0-9a-f]{64}$/.test(p.fingerprint)
  ||!optionalID(p.version_id)||!optionalID(p.existing_id)||!optionalID(p.accounting_account_id)||!optionalID(p.accounting_plan_id)
  ||p.category_domain!==(rule.direction==='payable'?'institutional_expense':'institutional_revenue'))throw Error('Invalid institutional monthly preview')
 if(p.amount!==null&&(!['string','number'].includes(typeof p.amount)||Number(exactPaymentAmount(p.amount))<=0))throw Error('Invalid preview amount')
 if(rule.frequency==='annual'&&(!Number.isInteger(p.annual_month)||p.annual_month<1||p.annual_month>12
  ||p.ready&&Number(competence.slice(5,7))!==p.annual_month))throw Error('Invalid annual anniversary month')
 if(p.ready&&(!p.active||!p.category_active||p.period_closed||p.existing_id!==null||p.version_id===null||p.amount===null||p.accounting_account_id===null||p.accounting_plan_id===null))throw Error('Inconsistent generation readiness')
 return p
}
