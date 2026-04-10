import test from 'node:test';
import assert from 'node:assert/strict';

import { SystemGitRepository } from '../src/adapters/git-repository.js';
import { GitNotInstalledError } from '../src/application/use-cases.js';
import { parseRemoteUrl } from '../src/domain/repository.js';

test('git repository adapter reads repository state', async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const adapter = new SystemGitRepository({
    binaryPath: 'git',
    exec: async (file, args) => {
      calls.push({ file, args });

      if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
        return { stdout: 'true\n', stderr: '' };
      }

      if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
        return { stdout: '/tmp/gitrole\n', stderr: '' };
      }

      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return { stdout: '6c99479\n', stderr: '' };
      }

      if (args[0] === 'branch') {
        return { stdout: 'main\n', stderr: '' };
      }

      if (args[0] === 'rev-parse' && args.includes('@{upstream}')) {
        return { stdout: 'origin/main\n', stderr: '' };
      }

      if (args[0] === 'remote') {
        return { stdout: 'git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git\n', stderr: '' };
      }

      if (args.at(-1) === 'user.name') {
        return { stdout: 'Sara Loera\n', stderr: '' };
      }

      if (args.at(-1) === 'user.email') {
        return { stdout: 'sara@synthesissoftworks.com\n', stderr: '' };
      }

      return { stdout: '', stderr: '' };
    }
  });

  assert.equal(await adapter.isInsideWorkTree(), true);
  assert.equal(await adapter.hasCommits(), true);
  assert.equal(await adapter.getTopLevelPath(), '/tmp/gitrole');
  assert.equal(await adapter.getCurrentBranch(), 'main');
  assert.equal(await adapter.getUpstreamBranch(), 'origin/main');
  assert.equal(
    await adapter.getOriginUrl(),
    'git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git'
  );
  assert.equal(await adapter.getLocalUserName(), 'Sara Loera');
  assert.equal(await adapter.getLocalUserEmail(), 'sara@synthesissoftworks.com');

  await adapter.setOriginUrl('git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git');

  assert.equal(calls[0]?.file, 'git');
  assert.deepEqual(calls.at(-1), {
    file: 'git',
    args: ['remote', 'set-url', 'origin', 'git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git']
  });
});

test('git repository adapter raises a clear error when git is missing', async () => {
  const adapter = new SystemGitRepository({
    exec: async () => {
      const error = new Error('spawn git ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
  });

  await assert.rejects(() => adapter.isInsideWorkTree(), GitNotInstalledError);
});

test('parseRemoteUrl parses ssh host aliases and https remotes', () => {
  assert.deepEqual(
    parseRemoteUrl('origin', 'git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git'),
    {
      name: 'origin',
      url: 'git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git',
      protocol: 'ssh',
      host: 'github.com-synsoftworksdev',
      owner: 'synsoftworksdev',
      repository: 'gitrole'
    }
  );

  assert.deepEqual(parseRemoteUrl('origin', 'https://github.com/openai/openai.git'), {
    name: 'origin',
    url: 'https://github.com/openai/openai.git',
    protocol: 'https',
    host: 'github.com',
    owner: 'openai',
    repository: 'openai'
  });
});
