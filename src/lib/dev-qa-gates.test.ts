import {describe,it,expect} from 'vitest'
import {assertQADenied,assertQARows,assertQAOneWinner} from './dev-qa-gates'
const good={data:'68ca5c28-b1bd-4d42-b758-f80b4b31a97f',error:null}
describe('DEV browser evidence assertions',()=>{
 it('does not confuse missing rows, transport or validation with authorization',()=>{
  for(const r of [{data:[],error:null},{data:null,error:{code:'22023'}},{data:null,error:{code:'PGRST205'}},{data:null,error:{}}])expect(()=>assertQADenied(r)).toThrow()
  expect(()=>assertQADenied({data:null,error:{code:'42501'}})).not.toThrow()
  expect(()=>assertQARows({data:null,error:{code:'42501'}},0)).toThrow()
 })
 it('requires one success and exactly the capacity constraint failure',()=>{
  expect(assertQAOneWinner([good,{data:null,error:{code:'23514'}}])).toBe(good.data)
  for(const rs of [[good,good],[good,{data:null,error:{code:'42501'}}],[{data:null,error:{code:'23514'}},{data:null,error:{code:'23514'}}]])expect(()=>assertQAOneWinner(rs)).toThrow()
 })
})
