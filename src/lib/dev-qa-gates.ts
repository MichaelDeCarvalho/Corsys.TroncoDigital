type Result={data:unknown;error:{code?:string}|null}
export function assertQABrowserTarget(enabled:string|undefined,url:string|undefined,hostname:string){
 if(enabled!=='true'||url!=='https://szqkdekwhzxsoxorgvaz.supabase.co'||
  !/^(?:(?:[a-f0-9]{8}|v35-finance)-)?corsys-tronco-digital-dev\.corsys1\.workers\.dev$/.test(hostname))throw Error('DEV QA target denied')
}
export function assertQADenied(r:Result,codes=['42501']){
 if(!r.error||!codes.includes(r.error.code??''))throw Error('Denial not proven: '+(r.error?.code??'success'))
}
export function assertQARows(r:Result,expected:number){
 if(r.error||!Array.isArray(r.data)||r.data.length!==expected)throw Error('Expected scoped rows not proven')
 return r.data as Record<string,unknown>[]
}
export function assertQAUUID(r:Result){
 if(r.error||typeof r.data!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(r.data))throw Error('Command not confirmed: '+(r.error?.code??'transport'))
 return r.data
}
export function assertQAOneWinner(rs:Result[]){
 if(rs.length!==2||rs.filter(r=>!r.error).length!==1||rs.filter(r=>r.error?.code==='23514').length!==1)throw Error('Capacity race not proven')
 return assertQAUUID(rs.find(r=>!r.error)!)
}
export function assertQAOneReversal(rs:Result[]){
 if(rs.length!==2||rs.filter(r=>!r.error).length!==1||rs.filter(r=>r.error?.code==='23505').length!==1)throw Error('Reversal race not proven')
 return assertQAUUID(rs.find(r=>!r.error)!)
}

export function assertQAMonthlyRace(rs:Result[],sameKey:boolean){
 if(rs.length!==2)throw Error('Monthly race requires two responses')
 if(sameKey){const id=assertQAUUID(rs[0]);if(assertQAUUID(rs[1])!==id)throw Error('Monthly replay differs');return id}
 if(rs.filter(r=>!r.error).length!==1||rs.filter(r=>r.error?.code==='40001').length!==1)throw Error('Monthly race not proven')
 return assertQAUUID(rs.find(r=>!r.error)!)
}
