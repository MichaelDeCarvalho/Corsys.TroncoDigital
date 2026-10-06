import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of ['tools/dev-environment.mjs', 'tools/create-test-fixture.mjs', 'tests/tenant-isolation.mjs', 'tests/dev-environment.test.mjs', 'tools/isolation-assertions.mjs', 'tests/isolation-assertions.test.mjs']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
const tests = spawnSync(process.execPath, ['--test', path.join(root, 'tests/dev-environment.test.mjs'), path.join(root, 'tests/isolation-assertions.test.mjs')], { stdio: 'inherit' });
process.exit(tests.status || (tests.error ? 1 : 0));

