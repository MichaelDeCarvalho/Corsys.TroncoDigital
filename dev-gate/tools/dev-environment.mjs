export function assertDevEnvironment(env = process.env) {
  if (env.CORSYS_DEV_FIXTURE_ACK !== 'DEV_ONLY') {
    throw new Error('Set CORSYS_DEV_FIXTURE_ACK=DEV_ONLY only for a disposable DEV project');
  }
  const ref = env.SUPABASE_DEV_PROJECT_REF;
  if (!ref || !/^[a-z]{20}$/.test(ref)) throw new Error('SUPABASE_DEV_PROJECT_REF must identify the selected DEV project');
  const url = new URL(env.SUPABASE_URL);
  if (url.origin !== `https://${ref}.supabase.co` || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('SUPABASE_URL must exactly match the selected DEV project');
  }
  const a = env.TEST_ADMIN_A_EMAIL?.trim().toLowerCase();
  const b = env.TEST_ADMIN_B_EMAIL?.trim().toLowerCase();
  if (!a || !b || a === b) throw new Error('Tenant A and B require distinct test identities');
  return ref;
}
