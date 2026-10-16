import type { SupabaseClient } from '@supabase/supabase-js'

export type PeriodState={organizationId:string;period:string;exists:boolean;closed:boolean;lastEvent:string|null}
export async function loadPeriodState(client:SupabaseClient,org:string,month:string,signal:AbortSignal):Promise<PeriodState>{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Invalid period')
 const period=month+'-01'
 const periods=await client.from('financial_periods').select('id,organization_id,period')
  .eq('organization_id',org).eq('period',period).limit(2).abortSignal(signal)
 if(periods.error)throw periods.error
 if(!Array.isArray(periods.data)||periods.data.length>1||
  periods.data.some(p=>p.organization_id!==org||p.period!==period||typeof p.id!=='string'))
   throw Error('Invalid tenant financial period')
 const row=periods.data[0]
 if(!row)return {organizationId:org,period,exists:false,closed:false,lastEvent:null}
 const events=await client.from('period_events')
  .select('id,organization_id,financial_period_id,event_type,event_seq')
  .eq('organization_id',org).eq('financial_period_id',row.id)
  .order('event_seq',{ascending:false}).limit(1).abortSignal(signal)
 if(events.error)throw events.error
 if(!Array.isArray(events.data)||events.data.length>1||
    events.data.some(e=>e.organization_id!==org||e.financial_period_id!==row.id||
    !['close','reopen'].includes(e.event_type)))throw Error('Invalid financial period event')
 const event=events.data[0]?.event_type??null
 return {organizationId:org,period,exists:true,closed:event==='close',lastEvent:event}
}
