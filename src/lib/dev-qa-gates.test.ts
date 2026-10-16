import {describe,it,expect} from 'vitest'
import {assertQADenied,assertQARows,assertQAOneWinner,assertQAOneReversal,assertQABrowserTarget} from './dev-qa-gates'
const good={data:'68ca5c28-b1bd-4d42-b758-f80b4b31a97f',error:null}
describe('DEV browser evidence assertions',()=>{
 it('accepts only explicit DEV builds and this DEV worker or its immutable version URLs',()=>{
  const target='https://szqkdekwhzxsoxorgvaz.supabase.co'
  for(const host of ['corsys-tronco-digital-dev.corsys1.workers.dev','1234abcd-corsys-tronco-digital-dev.corsys1.workers.dev','v35-finance-corsys-tronco-digital-dev.corsys1.workers.dev'])expect(()=>assertQABrowserTarget('true',target,host)).not.toThrow()
  for(const host of ['corsys-tronco-digital.corsys1.workers.dev','evil-corsys-tronco-digital-dev.corsys1.workers.dev','corsys-tronco-digital-dev.corsys1.workers.dev.evil.test','v35-finance-evil-corsys-tronco-digital-dev.corsys1.workers.dev'])expect(()=>assertQABrowserTarget('true',target,host)).toThrow()
  expect(()=>assertQABrowserTarget('false',target,'corsys-tronco-digital-dev.corsys1.workers.dev')).toThrow()
  expect(()=>assertQABrowserTarget('true','https://example.supabase.co','corsys-tronco-digital-dev.corsys1.workers.dev')).toThrow()
 })
 it('does not confuse missing rows, transport or validation with authorization',()=>{
  for(const r of [{data:[],error:null},{data:null,error:{code:'22023'}},{data:null,error:{code:'PGRST205'}},{data:null,error:{}}])expect(()=>assertQADenied(r)).toThrow()
  expect(()=>assertQADenied({data:null,error:{code:'42501'}})).not.toThrow()
  expect(()=>assertQARows({data:null,error:{code:'42501'}},0)).toThrow()
 })
 it('requires one success and exactly the capacity constraint failure',()=>{
  expect(assertQAOneWinner([good,{data:null,error:{code:'23514'}}])).toBe(good.data)
  for(const rs of [[good,good],[good,{data:null,error:{code:'42501'}}],[{data:null,error:{code:'23514'}},{data:null,error:{code:'23514'}}]])expect(()=>assertQAOneWinner(rs)).toThrow()
 })
 it('distinguishes a duplicate reversal race from capacity or permission failures',()=>{
  expect(assertQAOneReversal([good,{data:null,error:{code:'23505'}}])).toBe(good.data)
  for(const rs of [[good,good],[good,{data:null,error:{code:'42501'}}],[good,{data:null,error:{code:'23514'}}]])expect(()=>assertQAOneReversal(rs)).toThrow()
 })
})
