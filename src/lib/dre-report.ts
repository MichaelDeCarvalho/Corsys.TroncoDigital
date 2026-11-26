import type { SupabaseClient } from '@supabase/supabase-js'

export type DreEntry = {
 accounting_period: string
 accounting_plan_id: string
 accounting_account_id: string
 account_code: string
 account_description: string
 nature: 'revenue'|'cost'|'expense'|'financial_result'
 operational_classification: string | null
 signed_amount: string | number
}
const month=/^\d{4}-(0[1-9]|1[0-2])$/
const date=/^\d{4}-(0[1-9]|1[0-2])-01$/
const money=/^-?\d{1,12}(\.\d{1,2})?$/
const natures=['revenue','cost','expense','financial_result']

export function toMonthStart(value:string){
 if(!month.test(value))throw Error('Competência inválida')
 return value+'-01'
}
export function safeDreValue(value:string|number):number {
 if(!money.test(String(value)))throw Error('Montante contábil inválido')
 const num=Number(value)
 if(!Number.isFinite(num))throw Error('Montante contábil inválido')
 return num
}
export async function loadDreReport(
 client:SupabaseClient,org:string,fromMonth:string,toMonth:string,
):Promise<DreEntry[]> {
 const from=toMonthStart(fromMonth),to=toMonthStart(toMonth)
 const start=Number(fromMonth.slice(0,4))*12+Number(fromMonth.slice(5))
 const end=Number(toMonth.slice(0,4))*12+Number(toMonth.slice(5))
 if(end<start||end-start>=12)throw Error('Escolha até 12 competências consecutivas.')
 const {data,error}=await client.rpc('read_tenant_dre',{
  p_organization_id:org,p_from_period:from,p_to_period:to,
 })
 if(error)throw error
 if(!Array.isArray(data)||data.length>1500)throw Error('Consulta contábil incompleta ou inválida')
 for(const row of data){
  if(!row||typeof row!=='object'|| !date.test(row.accounting_period)||
    row.accounting_period<from||row.accounting_period>to||
    !natures.includes(row.nature)||typeof row.accounting_plan_id!=='string'||
    typeof row.accounting_account_id!=='string'||typeof row.account_code!=='string'||
    typeof row.account_description!=='string')throw Error('Relatório contábil inconsistente')
  safeDreValue(row.signed_amount)
 }
 summarizeDre(data as DreEntry[])
 return data as DreEntry[]
}
export function summarizeDre(rows:DreEntry[]){
 const months=new Map<string,Record<DreEntry['nature'],bigint>>()
 for(const row of rows){
  const current=months.get(row.accounting_period)??{revenue:0n,cost:0n,expense:0n,financial_result:0n}
  current[row.nature]+=BigInt(Math.round(safeDreValue(row.signed_amount)*100))
  months.set(row.accounting_period,current)
 }
 function amount(cents:bigint){
  const value=Number(cents)
  if(!Number.isSafeInteger(value))throw Error('Total contábil fora do limite de precisão')
  return value/100
 }
 return [...months.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([month,totals])=>{
  const operating=totals.revenue+totals.cost+totals.expense
  return {month,revenue:amount(totals.revenue),cost:amount(totals.cost),
   expenses:amount(totals.expense),financialResult:amount(totals.financial_result),
   operatingResult:amount(operating),result:amount(operating+totals.financial_result)}
 })
}

export type DreSection =
 | 'gross_revenue'
 | 'deductions'
 | 'cost'
 | 'operational_expense'
 | 'financial_result'

export type DreGerencialAccount = {
 accounting_plan_id: string
 accounting_account_id: string
 account_code: string
 account_description: string
 nature: 'revenue' | 'cost' | 'expense' | 'financial_result'
 operational_classification: string | null
 dre_section: DreSection
 amount: string | number
 prior_period_amount: string | number
 prior_year_amount: string | number
}

export type DreGerencialWaterfall = {
 gross_revenue: string | number
 deductions: string | number
 net_revenue: string | number
 costs: string | number
 gross_result: string | number
 operational_expenses: string | number
 operating_result: string | number
 financial_result: string | number
 net_result: string | number
}

export type DreGerencialMonth = DreGerencialWaterfall & {
 accounting_period: string
}

export type DreGerencialPlanRef = {
 id: string
 name: string
 status: 'draft' | 'published'
 valid_from: string
 valid_to: string
}

export type DreGerencialReport = {
 organization_id: string
 from_period: string
 to_period: string
 prior_period_from: string
 prior_period_to: string
 prior_year_from: string
 prior_year_to: string
 has_prior_period_data: boolean
 has_prior_year_data: boolean
 plans: DreGerencialPlanRef[]
 waterfall: DreGerencialWaterfall
 prior_period_waterfall: DreGerencialWaterfall | null
 prior_year_waterfall: DreGerencialWaterfall | null
 months: DreGerencialMonth[]
 accounts: DreGerencialAccount[]
 unmapped_count: number
 legacy_non_posting_count: number
 integral_ok: boolean
 incomplete_reasons: string[]
 report_classification: string
 official_disclaimer: string
}

function moneyToCents(value: string | number): bigint {
 const str = String(value).trim()
 if (!money.test(str) || !Number.isFinite(Number(str))) {
  throw Error('Montante contábil inválido na DRE Gerencial')
 }
 const negative = str.startsWith('-')
 const unsigned = negative ? str.slice(1) : str
 const [intPart, decPart = ''] = unsigned.split('.')
 const cents = BigInt(intPart) * 100n + BigInt((decPart + '00').slice(0, 2))
 return negative ? -cents : cents
}

function validateWaterfallCents(w: DreGerencialWaterfall) {
 const grossRev = moneyToCents(w.gross_revenue)
 const deductions = moneyToCents(w.deductions)
 const netRev = moneyToCents(w.net_revenue)
 const costs = moneyToCents(w.costs)
 const grossRes = moneyToCents(w.gross_result)
 const opExp = moneyToCents(w.operational_expenses)
 const opRes = moneyToCents(w.operating_result)
 const finRes = moneyToCents(w.financial_result)
 const netRes = moneyToCents(w.net_result)

 if (
  grossRev + deductions !== netRev ||
  netRev + costs !== grossRes ||
  grossRes + opExp !== opRes ||
  opRes + finRes !== netRes
 ) {
  throw Error('Inconsistência matemática na cascata da DRE Gerencial')
 }
 return { grossRev, deductions, netRev, costs, grossRes, opExp, opRes, finRes, netRes }
}

export async function loadDreGerencialReport(
 client: SupabaseClient,
 org: string,
 fromMonth: string,
 toMonth: string,
): Promise<DreGerencialReport> {
 const from = toMonthStart(fromMonth)
 const to = toMonthStart(toMonth)
 const start = Number(fromMonth.slice(0, 4)) * 12 + Number(fromMonth.slice(5))
 const end = Number(toMonth.slice(0, 4)) * 12 + Number(toMonth.slice(5))
 if (end < start || end - start >= 12) {
  throw Error('Escolha até 12 competências consecutivas.')
 }

 const { data, error } = await client.rpc('read_tenant_dre_gerencial', {
  p_organization_id: org,
  p_from_period: from,
  p_to_period: to,
 })
 if (error) throw error
 if (!data || typeof data !== 'object') {
  throw Error('Resposta da DRE Gerencial inválida ou incompleta.')
 }

 const rep = data as DreGerencialReport
 if (
  rep.organization_id !== org ||
  rep.from_period !== from ||
  rep.to_period !== to ||
  !Array.isArray(rep.accounts) ||
  !Array.isArray(rep.months) ||
  !Array.isArray(rep.plans) ||
  !rep.waterfall
 ) {
  throw Error('Relatório DRE Gerencial inconsistente com a Loja ou período solicitado.')
 }
 if (rep.accounts.length > 2000) {
  throw Error('DRE Gerencial excede o limite de 2.000 contas por consulta.')
 }

 const expected = validateWaterfallCents(rep.waterfall)
 if (rep.prior_period_waterfall) validateWaterfallCents(rep.prior_period_waterfall)
 if (rep.prior_year_waterfall) validateWaterfallCents(rep.prior_year_waterfall)

 const sectionSums: Record<DreSection, bigint> = {
  gross_revenue: 0n,
  deductions: 0n,
  cost: 0n,
  operational_expense: 0n,
  financial_result: 0n,
 }

 for (const acc of rep.accounts) {
  if (
   !acc ||
   typeof acc.accounting_account_id !== 'string' ||
   typeof acc.account_code !== 'string' ||
   typeof acc.account_description !== 'string' ||
   !(acc.dre_section in sectionSums)
  ) {
   throw Error('Conta contábil inválida na DRE Gerencial.')
  }
  sectionSums[acc.dre_section] += moneyToCents(acc.amount)
  moneyToCents(acc.prior_period_amount)
  moneyToCents(acc.prior_year_amount)
 }

 if (
  sectionSums.gross_revenue !== expected.grossRev ||
  sectionSums.deductions !== expected.deductions ||
  sectionSums.cost !== expected.costs ||
  sectionSums.operational_expense !== expected.opExp ||
  sectionSums.financial_result !== expected.finRes
 ) {
  throw Error('Soma das contas da DRE Gerencial diverge dos totalizadores da cascata.')
 }

 return rep
}

export function formatVariationPercent(currentValue: string | number, baseValue: string | number): string {
 const current = safeDreValue(currentValue)
 const base = safeDreValue(baseValue)
 if (base === 0) return current === 0 ? '0,0%' : 'N/A'
 const pct = ((current - base) / Math.abs(base)) * 100
 return `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`
}
