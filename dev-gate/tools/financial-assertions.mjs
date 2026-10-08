import assert from 'node:assert/strict'
export function sameResult(results) {
  assert.equal(results.length, 2)
  for (const r of results) assert.equal(r.error, null, 'Same-key concurrent request failed')
  assert.match(results[0].data || '', /^[0-9a-f-]{36}$/i)
  assert.equal(results[0].data, results[1].data, 'Same-key requests created different facts')
  return results[0].data
}
export function oneWinner(results) {
  assert.equal(results.length, 2)
  const wins = results.filter(r => r.error === null)
  const losses = results.filter(r => r.error !== null)
  assert.equal(wins.length, 1, 'Expected exactly one successful allocation')
  assert.equal(losses.length, 1)
  assert.equal(losses[0].error.code, '23514', 'Transport/validation errors are not a valid losing allocation')
  assert.match(wins[0].data || '', /^[0-9a-f-]{36}$/i)
  return wins[0].data
}

export function oneLifecycleEvent(results) {
 assert.equal(results.length,2)
 const wins=results.filter(r=>r.error===null)
 const losses=results.filter(r=>r.error!==null)
 assert.equal(wins.length,1,'Expected exactly one lifecycle event')
 assert.equal(losses.length,1)
 assert.equal(losses[0].error?.code,'23505','Only an exact duplicate event rejection counts')
 assert.match(wins[0].data||'',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
 return wins[0].data
}
