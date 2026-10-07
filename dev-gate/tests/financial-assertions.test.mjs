import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sameResult, oneWinner } from '../tools/financial-assertions.mjs'
const id = '00000000-0000-4000-8000-000000000001'
const win = { data:id, error:null }
test('same-key concurrency requires two successes with the same UUID', () => {
 assert.equal(sameResult([win, win]), id)
 assert.throws(() => sameResult([win, {data:'00000000-0000-4000-8000-000000000002',error:null}]))
 assert.throws(() => sameResult([win, {data:null,error:{code:'NETWORK'}}]))
})
test('competition requires one success and an exact balance constraint failure', () => {
 assert.equal(oneWinner([win,{data:null,error:{code:'23514'}}]),id)
 assert.throws(() => oneWinner([win,win]))
 assert.throws(() => oneWinner([win,{data:null,error:{code:'42501'}}]))
 assert.throws(() => oneWinner([win,{data:null,error:{code:'NETWORK'}}]))
 assert.throws(() => oneWinner([{data:null,error:{code:'23514'}},{data:null,error:{code:'23514'}}]))
})

