import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
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
  assert.match(result.stdout, /current \[options\]/);
  assert.match(result.stdout, /doctor/);
  assert.match(result.stdout, /remote/);
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
      'sara@example.com',
      '--github-user',
      'synsoftworksdev',
      '--github-host',
      'github.com-synsoftworksdev'
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
  assert.match(rolesFile, /"githubUser": "synsoftworksdev"/);
  assert.match(rolesFile, /"githubHost": "github.com-synsoftworksdev"/);
});

test('cli doctor exits with code 2 when warnings are present', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-cli-doctor-'));
  const configHome = path.join(tempDir, 'config');
  const gitStubPath = path.join(tempDir, 'git-stub.mjs');

  await writeFile(
    gitStubPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'config' && args[2] === '--get') {
  process.exit(1);
}
if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
  process.stdout.write('false\\n');
  process.exit(0);
}
process.exit(1);
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

  const result = spawnSync(process.execPath, [cliPath, 'doctor'], {
    encoding: 'utf8',
    env
  });

  assert.equal(result.status, 2);
  assert.match(result.stdout, /doctor/);
  assert.equal(result.stderr, '');
});

test('cli current --verbose renders the current heading instead of doctor', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-cli-current-'));
  const configHome = path.join(tempDir, 'config');
  const gitStubPath = path.join(tempDir, 'git-stub.mjs');

  await writeFile(
    gitStubPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'config' && args[2] === '--get') {
  process.exit(1);
}
if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
  process.stdout.write('false\\n');
  process.exit(0);
}
process.exit(1);
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

  const result = spawnSync(process.execPath, [cliPath, 'current', '--verbose'], {
    encoding: 'utf8',
    env
  });

  assert.equal(result.status, 2);
  assert.match(result.stdout, /^current/m);
  assert.doesNotMatch(result.stdout, /^doctor/m);
  assert.equal(result.stderr, '');
});

test('cli runs correctly when invoked through a symlinked entrypoint', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-cli-symlink-'));
  const linkedCliPath = path.join(tempDir, 'gitrole');

  await symlink(cliPath, linkedCliPath);

  const result = spawnSync(process.execPath, [linkedCliPath, '--help'], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Switch your full git identity in one command/);
  assert.equal(result.stderr, '');
});
