import {it,expect} from 'vitest'
import {mutualNumbers} from './mutual-batches'
it('bounds ranges and preserves both V35 ranges without silently assigning members',()=>{
 expect(mutualNumbers('710','721')).toHaveLength(12);expect(mutualNumbers('722','745')).toHaveLength(24)
 for(const pair of [['0','2'],['2','1'],['1','201'],['1.1','2'],['2147483647','2147483648']])expect(mutualNumbers(...pair as [string,string])).toEqual([])
})
