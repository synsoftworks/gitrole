import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));

test('cli help text includes the primary commands', () => {
  const result = spawnSync(process.execPath, [cliPath, '--help'], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /add \[options\] <name>/);
  assert.match(result.stdout, /current/);
  assert.equal(result.stderr, '');
});

test('cli routes add and list commands through the configured storage', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-cli-'));
  const configHome = path.join(tempDir, 'config');
  const gitStubPath = path.join(tempDir, 'git-stub.mjs');

  await writeFile(
    gitStubPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'config' && args[2] === '--get') {
  process.exit(1);
}
process.exit(0);
`,
    'utf8'
  );
  await chmod(gitStubPath, 0o755);

  const env = {
    ...process.env,
    HOME: tempDir,
    XDG_CONFIG_HOME: configHome,
    GITROLE_GIT_BIN: gitStubPath
  };

  const addResult = spawnSync(
    process.execPath,
    [
      cliPath,
      'add',
      'sara',
      '--name',
      'Sara Loera',
      '--email',
      'sara@example.com'
    ],
    { encoding: 'utf8', env }
  );

  assert.equal(addResult.status, 0);
  assert.match(addResult.stdout, /saved/);

  const listResult = spawnSync(process.execPath, [cliPath, 'list'], {
    encoding: 'utf8',
    env
  });

  assert.equal(listResult.status, 0);
  assert.match(listResult.stdout, /sara/);

  const rolesFile = await readFile(
    path.join(configHome, 'gitrole', 'roles.json'),
    'utf8'
  );

  assert.match(rolesFile, /"name": "sara"/);
});
