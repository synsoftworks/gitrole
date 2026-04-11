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
  runCli,
  saveRole,
  setGlobalIdentity,
  setOrigin
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
