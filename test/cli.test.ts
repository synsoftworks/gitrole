import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
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
  assert.match(result.stdout, /status/);
  assert.match(result.stdout, /use \[options\] <name>/);
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

test('cli use --local applies the role to repository-local git config', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-cli-use-local-'));
  const configHome = path.join(tempDir, 'config');
  const gitStubPath = path.join(tempDir, 'git-stub.mjs');
  const gitLogPath = path.join(tempDir, 'git.log');
  const sshStubPath = path.join(tempDir, 'ssh-stub.mjs');

  await writeFile(
    gitStubPath,
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(gitLogPath)}, JSON.stringify(args) + "\\n");
if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
  process.stdout.write('true\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--verify') {
  process.stdout.write('abcdef0\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
  process.stdout.write(${JSON.stringify(tempDir + '\n')});
  process.exit(0);
}
if (args[0] === 'rev-parse' && args.includes('@{upstream}')) {
  process.stdout.write('origin/main\\n');
  process.exit(0);
}
if (args[0] === 'branch' && args[1] === '--show-current') {
  process.stdout.write('main\\n');
  process.exit(0);
}
if (args[0] === 'remote' && args[1] === 'get-url' && args[2] === 'origin') {
  process.stdout.write('git@github.com-acme-dev:acme-dev/gitrole.git\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--local' && args[2] === '--get' && args[3] === 'user.name') {
  process.stdout.write('Alex Developer\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--local' && args[2] === '--get' && args[3] === 'user.email') {
  process.stdout.write('alex@work.example\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--global' && args[2] === '--get') {
  process.exit(1);
}
if (args[0] === 'config' && (args[1] === '--local' || args[1] === '--global')) {
  process.exit(0);
}
process.exit(1);
`,
    'utf8'
  );
  await chmod(gitStubPath, 0o755);
  await writeFile(
    sshStubPath,
    `#!/usr/bin/env node
process.stderr.write("Hi acme-dev! You've successfully authenticated, but GitHub does not provide shell access.\\n");
process.exit(1);
`,
    'utf8'
  );
  await chmod(sshStubPath, 0o755);
  await mkdir(path.join(configHome, 'gitrole'), { recursive: true });
  await writeFile(
    path.join(configHome, 'gitrole', 'roles.json'),
    JSON.stringify(
      {
        roles: [
          {
            name: 'work',
            fullName: 'Alex Developer',
            email: 'alex@work.example',
            githubUser: 'acme-dev',
            githubHost: 'github.com-acme-dev'
          }
        ]
      },
      null,
      2
    ),
    'utf8'
  );

  const env = {
    ...process.env,
    HOME: tempDir,
    XDG_CONFIG_HOME: configHome,
    GITROLE_GIT_BIN: gitStubPath,
    GITROLE_SSH_BIN: sshStubPath
  };

  const result = spawnSync(process.execPath, [cliPath, 'use', 'work', '--local'], {
    encoding: 'utf8',
    env
  });

  const log = await readFile(gitLogPath, 'utf8');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /scope\s+local/);
  assert.match(log, /"config","--local","user.name","Alex Developer"/);
  assert.match(log, /"config","--local","user.email","alex@work.example"/);
  assert.doesNotMatch(log, /"config","--global","user.name","Alex Developer"/);
  assert.equal(result.stderr, '');
});

test('cli use --local fails outside a git repository', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-cli-use-local-error-'));
  const configHome = path.join(tempDir, 'config');
  const gitStubPath = path.join(tempDir, 'git-stub.mjs');

  await writeFile(
    gitStubPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
  process.stdout.write('false\\n');
  process.exit(0);
}
process.exit(1);
`,
    'utf8'
  );
  await chmod(gitStubPath, 0o755);
  await mkdir(path.join(configHome, 'gitrole'), { recursive: true });
  await writeFile(
    path.join(configHome, 'gitrole', 'roles.json'),
    JSON.stringify(
      {
        roles: [{ name: 'work', fullName: 'Alex Developer', email: 'alex@work.example' }]
      },
      null,
      2
    ),
    'utf8'
  );

  const env = {
    ...process.env,
    HOME: tempDir,
    XDG_CONFIG_HOME: configHome,
    GITROLE_GIT_BIN: gitStubPath
  };

  const result = spawnSync(process.execPath, [cliPath, 'use', 'work', '--local'], {
    encoding: 'utf8',
    env
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(
    result.stderr,
    /error: not inside a git repository; --local requires a repo context/
  );
});

test('cli status exits with code 2 and prints a compact warning summary when misaligned', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-cli-status-'));
  const configHome = path.join(tempDir, 'config');
  const gitStubPath = path.join(tempDir, 'git-stub.mjs');
  const sshStubPath = path.join(tempDir, 'ssh-stub.mjs');

  await writeFile(
    gitStubPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'config' && args[1] === '--global' && args[2] === '--get' && args[3] === 'user.name') {
  process.stdout.write('Pat Person\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--global' && args[2] === '--get' && args[3] === 'user.email') {
  process.stdout.write('pat@personal.example\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--local' && args[2] === '--get') {
  process.exit(1);
}
if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
  process.stdout.write('true\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--verify') {
  process.stdout.write('abcdef0\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
  process.stdout.write('${tempDir.replaceAll("'", "'\\''")}\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args.includes('@{upstream}')) {
  process.stdout.write('origin/main\\n');
  process.exit(0);
}
if (args[0] === 'branch' && args[1] === '--show-current') {
  process.stdout.write('main\\n');
  process.exit(0);
}
if (args[0] === 'remote' && args[1] === 'get-url' && args[2] === 'origin') {
  process.stdout.write('git@github.com-acme-dev:acme-dev/gitrole.git\\n');
  process.exit(0);
}
process.exit(1);
`,
    'utf8'
  );
  await chmod(gitStubPath, 0o755);

  await writeFile(
    sshStubPath,
    `#!/usr/bin/env node
process.stderr.write("Hi acme-dev! You've successfully authenticated, but GitHub does not provide shell access.\\n");
process.exit(1);
`,
    'utf8'
  );
  await chmod(sshStubPath, 0o755);

  await mkdir(path.join(configHome, 'gitrole'), { recursive: true });

  await writeFile(
    path.join(configHome, 'gitrole', 'roles.json'),
    JSON.stringify(
      {
        roles: [
          {
            name: 'work',
            fullName: 'Alex Developer',
            email: 'alex@work.example',
            githubUser: 'acme-dev',
            githubHost: 'github.com-acme-dev'
          }
        ]
      },
      null,
      2
    ),
    'utf8'
  );

  const env = {
    ...process.env,
    HOME: tempDir,
    XDG_CONFIG_HOME: configHome,
    GITROLE_GIT_BIN: gitStubPath,
    GITROLE_SSH_BIN: sshStubPath
  };

  const result = spawnSync(process.execPath, [cliPath, 'status'], {
    encoding: 'utf8',
    env
  });

  assert.equal(result.status, 2);
  assert.match(result.stdout, /no-role/);
  assert.match(result.stdout, /global/);
  assert.match(result.stdout, /warning/);
  assert.equal(result.stderr, '');
});

test('cli doctor shows the hidden global identity when a local override is active', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-cli-doctor-local-'));
  const configHome = path.join(tempDir, 'config');
  const gitStubPath = path.join(tempDir, 'git-stub.mjs');
  const sshStubPath = path.join(tempDir, 'ssh-stub.mjs');

  await writeFile(
    gitStubPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'config' && args[1] === '--global' && args[2] === '--get' && args[3] === 'user.name') {
  process.stdout.write('Sara Personal\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--global' && args[2] === '--get' && args[3] === 'user.email') {
  process.stdout.write('sara@personal.example\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--local' && args[2] === '--get' && args[3] === 'user.name') {
  process.stdout.write('Synthesis Softworks\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--local' && args[2] === '--get' && args[3] === 'user.email') {
  process.stdout.write('dev@synthesissoftworks.com\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
  process.stdout.write('true\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--verify') {
  process.stdout.write('abcdef0\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
  process.stdout.write('${tempDir.replaceAll("'", "'\\''")}\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args.includes('@{upstream}')) {
  process.stdout.write('origin/main\\n');
  process.exit(0);
}
if (args[0] === 'branch' && args[1] === '--show-current') {
  process.stdout.write('main\\n');
  process.exit(0);
}
if (args[0] === 'remote' && args[1] === 'get-url' && args[2] === 'origin') {
  process.stdout.write('git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git\\n');
  process.exit(0);
}
process.exit(1);
`,
    'utf8'
  );
  await chmod(gitStubPath, 0o755);
  await writeFile(
    sshStubPath,
    `#!/usr/bin/env node
process.stderr.write("Hi synsoftworksdev! You've successfully authenticated, but GitHub does not provide shell access.\\n");
process.exit(1);
`,
    'utf8'
  );
  await chmod(sshStubPath, 0o755);
  await mkdir(path.join(configHome, 'gitrole'), { recursive: true });
  await writeFile(
    path.join(configHome, 'gitrole', 'roles.json'),
    JSON.stringify(
      {
        roles: [
          {
            name: 'synsoft',
            fullName: 'Synthesis Softworks',
            email: 'dev@synthesissoftworks.com',
            githubUser: 'synsoftworksdev',
            githubHost: 'github.com-synsoftworksdev'
          }
        ]
      },
      null,
      2
    ),
    'utf8'
  );

  const env = {
    ...process.env,
    HOME: tempDir,
    XDG_CONFIG_HOME: configHome,
    GITROLE_GIT_BIN: gitStubPath,
    GITROLE_SSH_BIN: sshStubPath
  };

  const result = spawnSync(process.execPath, [cliPath, 'doctor'], {
    encoding: 'utf8',
    env
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /scope\s+local/);
  assert.match(result.stdout, /local\s+active/);
  assert.match(result.stdout, /global\s+Sara Personal <sara@personal.example>/);
  assert.equal(result.stderr, '');
});

test('cli status shows local override when repo-local identity is effective', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-cli-status-local-'));
  const configHome = path.join(tempDir, 'config');
  const gitStubPath = path.join(tempDir, 'git-stub.mjs');
  const sshStubPath = path.join(tempDir, 'ssh-stub.mjs');

  await writeFile(
    gitStubPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'config' && args[1] === '--global' && args[2] === '--get' && args[3] === 'user.name') {
  process.stdout.write('Sara Personal\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--global' && args[2] === '--get' && args[3] === 'user.email') {
  process.stdout.write('sara@personal.example\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--local' && args[2] === '--get' && args[3] === 'user.name') {
  process.stdout.write('Synthesis Softworks\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--local' && args[2] === '--get' && args[3] === 'user.email') {
  process.stdout.write('dev@synthesissoftworks.com\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
  process.stdout.write('true\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--verify') {
  process.stdout.write('abcdef0\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
  process.stdout.write('${tempDir.replaceAll("'", "'\\''")}\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args.includes('@{upstream}')) {
  process.stdout.write('origin/main\\n');
  process.exit(0);
}
if (args[0] === 'branch' && args[1] === '--show-current') {
  process.stdout.write('main\\n');
  process.exit(0);
}
if (args[0] === 'remote' && args[1] === 'get-url' && args[2] === 'origin') {
  process.stdout.write('git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git\\n');
  process.exit(0);
}
process.exit(1);
`,
    'utf8'
  );
  await chmod(gitStubPath, 0o755);
  await writeFile(
    sshStubPath,
    `#!/usr/bin/env node
process.stderr.write("Hi synsoftworksdev! You've successfully authenticated, but GitHub does not provide shell access.\\n");
process.exit(1);
`,
    'utf8'
  );
  await chmod(sshStubPath, 0o755);
  await mkdir(path.join(configHome, 'gitrole'), { recursive: true });
  await writeFile(
    path.join(configHome, 'gitrole', 'roles.json'),
    JSON.stringify(
      {
        roles: [
          {
            name: 'synsoft',
            fullName: 'Synthesis Softworks',
            email: 'dev@synthesissoftworks.com',
            githubUser: 'synsoftworksdev',
            githubHost: 'github.com-synsoftworksdev'
          }
        ]
      },
      null,
      2
    ),
    'utf8'
  );

  const env = {
    ...process.env,
    HOME: tempDir,
    XDG_CONFIG_HOME: configHome,
    GITROLE_GIT_BIN: gitStubPath,
    GITROLE_SSH_BIN: sshStubPath
  };

  const result = spawnSync(process.execPath, [cliPath, 'status'], {
    encoding: 'utf8',
    env
  });

  assert.equal(result.status, 0);
  assert.match(
    result.stdout,
    /synsoft\s+Synthesis Softworks <dev@synthesissoftworks.com>\s+local override\s+aligned/
  );
  assert.equal(result.stderr, '');
});

test('cli status --short prints machine-friendly status output', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-cli-status-short-'));
  const configHome = path.join(tempDir, 'config');
  const gitStubPath = path.join(tempDir, 'git-stub.mjs');
  const sshStubPath = path.join(tempDir, 'ssh-stub.mjs');

  await writeFile(
    gitStubPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'config' && args[1] === '--global' && args[2] === '--get' && args[3] === 'user.name') {
  process.stdout.write('Alex Developer\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--global' && args[2] === '--get' && args[3] === 'user.email') {
  process.stdout.write('alex@work.example\\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === '--local' && args[2] === '--get') {
  process.exit(1);
}
if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
  process.stdout.write('true\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--verify') {
  process.stdout.write('abcdef0\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
  process.stdout.write('${tempDir.replaceAll("'", "'\\''")}\\n');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args.includes('@{upstream}')) {
  process.stdout.write('origin/main\\n');
  process.exit(0);
}
if (args[0] === 'branch' && args[1] === '--show-current') {
  process.stdout.write('main\\n');
  process.exit(0);
}
if (args[0] === 'remote' && args[1] === 'get-url' && args[2] === 'origin') {
  process.stdout.write('git@github.com-acme-dev:acme-dev/gitrole.git\\n');
  process.exit(0);
}
process.exit(1);
`,
    'utf8'
  );
  await chmod(gitStubPath, 0o755);

  await writeFile(
    sshStubPath,
    `#!/usr/bin/env node
process.stderr.write("Hi acme-dev! You've successfully authenticated, but GitHub does not provide shell access.\\n");
process.exit(1);
`,
    'utf8'
  );
  await chmod(sshStubPath, 0o755);

  await mkdir(path.join(configHome, 'gitrole'), { recursive: true });

  await writeFile(
    path.join(configHome, 'gitrole', 'roles.json'),
    JSON.stringify(
      {
        roles: [
          {
            name: 'work',
            fullName: 'Alex Developer',
            email: 'alex@work.example',
            githubUser: 'acme-dev',
            githubHost: 'github.com-acme-dev'
          }
        ]
      },
      null,
      2
    ),
    'utf8'
  );

  const env = {
    ...process.env,
    HOME: tempDir,
    XDG_CONFIG_HOME: configHome,
    GITROLE_GIT_BIN: gitStubPath,
    GITROLE_SSH_BIN: sshStubPath
  };

  const result = spawnSync(process.execPath, [cliPath, 'status', '--short'], {
    encoding: 'utf8',
    env
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /role=work/);
  assert.match(result.stdout, /scope=global/);
  assert.match(result.stdout, /override=false/);
  assert.match(result.stdout, /commit=ok/);
  assert.match(result.stdout, /remote=ok/);
  assert.match(result.stdout, /auth=ok/);
  assert.match(result.stdout, /overall=aligned/);
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
