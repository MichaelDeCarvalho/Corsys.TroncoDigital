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
  assert.equal(result.error?.code, '42501', label + ': exact permission denial required')
}

