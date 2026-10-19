import {expect,it} from 'vitest'
import {assertLegacyConflict} from './dev-qa-legacy'
it('requires both real HTTP status and PT409, never treating a timeout or another error as conflict evidence',()=>{
 expect(()=>assertLegacyConflict({status:409,error:{code:'PT409'}})).not.toThrow()
 for(const r of [{status:200,error:null},{status:0,error:{code:'PT409'}},{status:409,error:{code:'23503'}},{status:504,error:{code:'PT409'}}])expect(()=>assertLegacyConflict(r)).toThrow()
})
