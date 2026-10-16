import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDevEnvironment } from '../tools/dev-environment.mjs';

const valid = {
  CORSYS_DEV_FIXTURE_ACK: 'DEV_ONLY',
  SUPABASE_DEV_PROJECT_REF: 'abcdefghijklmnopqrst',
  SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  TEST_ADMIN_A_EMAIL: 'a@example.invalid', TEST_ADMIN_B_EMAIL: 'b@example.invalid'
};
test('explicit DEV target and separate identities are accepted', () => {
  assert.equal(assertDevEnvironment(valid), valid.SUPABASE_DEV_PROJECT_REF);
});
test('fixture writes fail before client creation without explicit DEV acknowledgement', () => {
  assert.throws(() => assertDevEnvironment({...valid, CORSYS_DEV_FIXTURE_ACK: ''}), /DEV_ONLY/);
});
test('mismatched target, credentials, paths and query strings are rejected', () => {
  for (const url of ['https://otherproject.supabase.co', 'http://abcdefghijklmnopqrst.supabase.co', 'https://key@abcdefghijklmnopqrst.supabase.co', 'https://abcdefghijklmnopqrst.supabase.co/rest/v1', 'https://abcdefghijklmnopqrst.supabase.co?x=1']) {
    assert.throws(() => assertDevEnvironment({...valid, SUPABASE_URL: url}), /exactly match/);
  }
});
test('duplicate identities cannot produce a false cross-tenant PASS', () => {
  assert.throws(() => assertDevEnvironment({...valid, TEST_ADMIN_B_EMAIL: ' A@EXAMPLE.INVALID '}), /distinct/);
});
