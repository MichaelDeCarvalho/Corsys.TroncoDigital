// Assertions shared by real HTTP checks and failure-path tests.
import assert from 'node:assert/strict'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validateFixture(fixture, projectRef) {
  assert.equal(projectRef, 'szqkdekwhzxsoxorgvaz', 'Only the authorized Corsys DEV project is accepted')
  assert.equal(fixture.project_ref, projectRef, 'Fixture project mismatch')
  for (const key of ['organization_id', 'admin_user_id']) {
    const a = fixture.tenant_a?.[key], b = fixture.tenant_b?.[key]
    assert.match(a || '', uuid, 'Missing or invalid tenant A fixture UUID')
    assert.match(b || '', uuid, 'Missing or invalid tenant B fixture UUID')
    assert.notEqual(a, b, 'Distinct fixture organizations and users are required')
  }
}
export function requireRows(result, label) {
  assert.equal(result.error, null, label + ': API error is not a valid denial')
  assert.ok(Array.isArray(result.data), label + ': response must be an array')
  return result.data
}
export function assertOwnAndOther(result, ownId, otherId, key, label) {
  const rows = requireRows(result, label)
  assert.ok(rows.some(row => row[key] === ownId), label + ': positive own row required')
  assert.ok(rows.every(row => row[key] === ownId), label + ': unexpected organization exposed')
  assert.ok(!rows.some(row => row[key] === otherId), label + ': cross-tenant row exposed')
}
export function assertHidden(result, label) {
  assert.equal(requireRows(result, label).length, 0, label + ': private rows exposed')
}
export function assertPermissionDenied(result, label) {
  const code = result?.error?.code
  assert.notEqual(code, 'PGRST202', label + ': missing RPC or invalid signature (PGRST202) is not a valid denial')
  assert.notEqual(code, '42883', label + ': undefined function (42883) is not a valid denial')
  assert.notEqual(code, '22023', label + ': invalid parameter (22023) is not a valid denial')
  assert.equal(code, '42501', label + ': exact permission denial required')
}
export function assertAuthorizedRpcSuccess(result, label) {
  assert.equal(result?.error, null, label + ': authorized RPC failed (' + (result?.error?.code || 'unknown') + ')')
  assert.notEqual(result?.data, null, label + ': authorized RPC returned null data')
  assert.notEqual(result?.data, undefined, label + ': authorized RPC returned undefined data')
  return result.data
}

