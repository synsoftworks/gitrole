/*
 * Exercises representative end-to-end CLI workflows in hermetic repositories.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertNoWarnChecks,
  commitEmpty,
  createHermeticWorkspace,
  getLocalConfigValue,
  getOriginUrl,
  initRepo,
  mustSucceed,
  parseJsonOutput,
  runCli,
  saveRole,
  setGlobalIdentity,
  setOrigin,
  writeRepoPolicy
} from './harness.js';

test('e2e status --short is exact for an aligned local override on an org remote', async () => {
  const workspace = await createHermeticWorkspace({
    sshUsersByHost: {
      'github.com-acme-dev': 'alex-dev'
    }
  });

  await initRepo(workspace);
  setGlobalIdentity(workspace, {
    name: 'Pat Person',
    email: 'pat@personal.example'
  });
  commitEmpty(workspace, {
    message: 'feat: initial aligned work commit',
    name: 'Alex Developer',
    email: 'alex@work.example'
  });
  setOrigin(workspace, 'git@github.com-acme-dev:acme-corp/service.git');
  await saveRole(workspace, {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example',
    githubUser: 'alex-dev',
    githubHost: 'github.com-acme-dev'
  });

  const useResult = runCli(workspace, ['use', 'work', '--local']);
  mustSucceed(useResult, 'gitrole use work --local failed');
  assert.match(useResult.stdout, /scope\s+local/);
  assert.doesNotMatch(useResult.stdout, /repo note:/);

  const statusResult = runCli(workspace, ['status', '--short']);
  mustSucceed(statusResult, 'gitrole status --short failed');
  assert.equal(
    statusResult.stdout.trim(),
    'role=work scope=local override=true commit=ok remote=ok auth=ok overall=aligned'
  );
  assert.equal(getLocalConfigValue(workspace, 'user.name'), 'Alex Developer');
  assert.equal(getLocalConfigValue(workspace, 'user.email'), 'alex@work.example');
});

test('e2e doctor --json keeps org ownership as context, not a warning', async () => {
  const workspace = await createHermeticWorkspace({
    sshUsersByHost: {
      'github.com-acme-dev': 'alex-dev'
    }
  });

  await initRepo(workspace);
  setGlobalIdentity(workspace, {
    name: 'Alex Developer',
    email: 'alex@work.example'
  });
  commitEmpty(workspace, {
    message: 'feat: org remote check'
  });
  setOrigin(workspace, 'git@github.com-acme-dev:acme-corp/service.git');
  await saveRole(workspace, {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example',
    githubUser: 'alex-dev',
    githubHost: 'github.com-acme-dev'
  });

  const doctorResult = runCli(workspace, ['doctor', '--json']);
  mustSucceed(doctorResult, 'gitrole doctor --json failed');
  const parsed = JSON.parse(doctorResult.stdout) as {
    overall: string;
    repository: {
      remote?: {
        owner?: string;
        repository?: string;
      };
    };
    checks: Array<{ status: string; label: string }>;
  };

  assert.equal(parsed.overall, 'aligned');
  assert.equal(parsed.repository.remote?.owner, 'acme-corp');
  assert.equal(parsed.repository.remote?.repository, 'service');
  assertNoWarnChecks(parsed);
  assert.equal(parsed.checks.some((check) => check.label === 'owner'), false);
});

test('e2e status --short warns on HTTPS remotes even when identity matches', async () => {
  const workspace = await createHermeticWorkspace();

  await initRepo(workspace);
  setGlobalIdentity(workspace, {
    name: 'Alex Developer',
    email: 'alex@work.example'
  });
  commitEmpty(workspace, {
    message: 'feat: https remote state'
  });
  setOrigin(workspace, 'https://github.com/acme-corp/service.git');
  await saveRole(workspace, {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example',
    githubUser: 'alex-dev'
  });

  const statusResult = runCli(workspace, ['status', '--short']);

  assert.equal(statusResult.status, 2);
  assert.equal(
    statusResult.stdout.trim(),
    'role=work scope=global override=false commit=ok remote=ok auth=warn overall=warning'
  );
});

test('e2e status --short warns when origin is missing', async () => {
  const workspace = await createHermeticWorkspace();

  await initRepo(workspace);
  setGlobalIdentity(workspace, {
    name: 'Alex Developer',
    email: 'alex@work.example'
  });
  commitEmpty(workspace, {
    message: 'feat: no origin configured'
  });
  await saveRole(workspace, {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example'
  });

  const statusResult = runCli(workspace, ['status', '--short']);

  assert.equal(statusResult.status, 2);
  assert.equal(
    statusResult.stdout.trim(),
    'role=work scope=global override=false commit=ok remote=warn auth=na overall=warning'
  );
});

test('e2e status --short warns on a new repo with no commits yet', async () => {
  const workspace = await createHermeticWorkspace({
    sshUsersByHost: {
      'github.com-acme-dev': 'alex-dev'
    }
  });

  await initRepo(workspace);
  setGlobalIdentity(workspace, {
    name: 'Alex Developer',
    email: 'alex@work.example'
  });
  setOrigin(workspace, 'git@github.com-acme-dev:acme-corp/service.git');
  await saveRole(workspace, {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example',
    githubUser: 'alex-dev',
    githubHost: 'github.com-acme-dev'
  });

  const statusResult = runCli(workspace, ['status', '--short']);

  assert.equal(statusResult.status, 2);
  assert.equal(
    statusResult.stdout.trim(),
    'role=work scope=global override=false commit=ok remote=warn auth=ok overall=warning'
  );
});

test('e2e remote set preserves owner and repository while rewriting the host alias', async () => {
  const workspace = await createHermeticWorkspace();

  await initRepo(workspace);
  setOrigin(workspace, 'git@github.com:acme-corp/service.git');
  await saveRole(workspace, {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example',
    githubHost: 'github.com-acme-dev'
  });

  const remoteSetResult = runCli(workspace, ['remote', 'set', 'work']);
  mustSucceed(remoteSetResult, 'gitrole remote set work failed');
  assert.match(remoteSetResult.stdout, /updated remote\s+origin/);
  assert.equal(
    getOriginUrl(workspace),
    'git@github.com-acme-dev:acme-corp/service.git'
  );
});

test('e2e shared org repo stays aligned when the effective role is allowed but not default', async () => {
  const workspace = await createHermeticWorkspace({
    sshUsersByHost: {
      'github.com-saraeloop': 'saraeloop'
    }
  });

  await initRepo(workspace);
  setGlobalIdentity(workspace, {
    name: 'Sara Loera',
    email: 'saraeloop@gmail.com'
  });
  await saveRole(workspace, {
    name: 'saraeloop',
    fullName: 'Sara Loera',
    email: 'saraeloop@gmail.com',
    githubUser: 'saraeloop',
    githubHost: 'github.com-saraeloop'
  });
  commitEmpty(workspace, {
    message: 'docs: shared repo policy check'
  });
  setOrigin(workspace, 'git@github.com-saraeloop:open-source-org/gitrole.git');
  await writeRepoPolicy(workspace, {
    defaultRole: 'synsoftworksdev',
    allowedRoles: ['synsoftworksdev', 'saraeloop']
  });

  const statusResult = runCli(workspace, ['status']);
  mustSucceed(statusResult, 'gitrole status failed for shared org repo');
  assert.match(statusResult.stdout, /repo policy\s+allowed role saraeloop \(default: synsoftworksdev\)/);
  assert.doesNotMatch(statusResult.stdout, /\bwarning\b/);

  const statusShortResult = runCli(workspace, ['status', '--short']);
  mustSucceed(statusShortResult, 'gitrole status --short failed for shared org repo');
  assert.equal(
    statusShortResult.stdout.trim(),
    'role=saraeloop scope=global override=false commit=ok remote=ok auth=ok overall=aligned'
  );

  const doctorResult = runCli(workspace, ['doctor']);
  mustSucceed(doctorResult, 'gitrole doctor failed for shared org repo');
  assert.match(doctorResult.stdout, /policy\s+\.gitrole \(v1\)/);
  assert.match(doctorResult.stdout, /default\s+synsoftworksdev/);
  assert.match(doctorResult.stdout, /allowed\s+synsoftworksdev, saraeloop/);
  assert.match(doctorResult.stdout, /\n\s*info policy\s+effective role saraeloop is allowed here, but repo defaultRole is synsoftworksdev/);
  assert.doesNotMatch(doctorResult.stdout, /\n\s*warn policy\s+/);

  const doctorJson = parseJsonOutput<{
    overall: string;
    repoPolicy?: {
      version: number;
      defaultRole: string;
      allowedRoles: string[];
      effectiveRole?: string;
      status: string;
    };
    checks: Array<{ label: string; status: string }>;
  }>(runCli(workspace, ['doctor', '--json']), 'gitrole doctor --json failed for shared org repo');

  assert.equal(doctorJson.overall, 'aligned');
  assert.deepEqual(doctorJson.repoPolicy, {
    version: 1,
    defaultRole: 'synsoftworksdev',
    allowedRoles: ['synsoftworksdev', 'saraeloop'],
    effectiveRole: 'saraeloop',
    status: 'allowed'
  });
  assert.equal(
    doctorJson.checks.some((check) => check.label === 'policy' && check.status === 'info'),
    true
  );
});
