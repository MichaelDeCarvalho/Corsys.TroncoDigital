import test from 'node:test'
import assert from 'node:assert/strict'
import { validateFixture, assertOwnAndOther, assertHidden, assertPermissionDenied } from '../tools/isolation-assertions.mjs'
const own = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const ok = data => ({ data, error: null })
test('own row plus no leaked tenant is required', () => {
  assertOwnAndOther(ok([{organization_id:own}]), own, other, 'organization_id', 'own')
  for (const data of [[], [{organization_id:other}], [{organization_id:own},{organization_id:other}], [{organization_id:own},{organization_id:'unexpected'}]]) {
    assert.throws(() => assertOwnAndOther(ok(data),own,other,'organization_id','own'))
  }
})
test('network, missing relation and permission errors do not count as hidden rows', () => {
  for (const code of ['42501','42P01','PGRST205','FETCH_ERROR']) {
    assert.throws(() => assertHidden({data:null,error:{code}},'hidden'))
  }
  assert.throws(() => assertHidden(ok(null),'hidden'))
  assert.throws(() => assertHidden(ok([{id:own}]),'hidden'))
  assertHidden(ok([]),'hidden')
})
test('failed input validation and transport failure are not authorization proof', () => {
  for (const code of [undefined,'22023','23503','FETCH_ERROR']) {
    assert.throws(() => assertPermissionDenied({error:code ? {code}:null},'rpc'))
  }
  assertPermissionDenied({error:{code:'42501'}},'rpc')
})
test('wrong project, duplicate identities and malformed fixture fail closed', () => {
  const fixture = {project_ref:'szqkdekwhzxsoxorgvaz',tenant_a:{organization_id:own,admin_user_id:own},tenant_b:{organization_id:other,admin_user_id:other}}
  validateFixture(fixture,fixture.project_ref)
  assert.throws(() => validateFixture({...fixture,project_ref:'abcdefghijklmnopqrst'},'abcdefghijklmnopqrst'))
  assert.throws(() => validateFixture({...fixture,tenant_b:fixture.tenant_a},fixture.project_ref))
  assert.throws(() => validateFixture({...fixture,tenant_b:{}},fixture.project_ref))
})
