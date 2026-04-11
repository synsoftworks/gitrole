import test from 'node:test';
import assert from 'node:assert/strict';

import { SystemGitConfig } from '../src/adapters/git-config.js';
import { GitNotInstalledError } from '../src/application/use-cases/index.js';

test('git config adapter reads and writes the expected global keys', async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const adapter = new SystemGitConfig({
    binaryPath: 'git',
    exec: async (file, args) => {
      calls.push({ file, args });

      if (args.at(-1) === 'user.name') {
        return { stdout: 'Sara Loera\n', stderr: '' };
      }

      if (args.at(-1) === 'user.email') {
        return { stdout: 'sara@example.com\n', stderr: '' };
      }

      return { stdout: '', stderr: '' };
    }
  });

  await adapter.setGlobalUserName('Sara Loera');
  await adapter.setGlobalUserEmail('sara@example.com');

  const name = await adapter.getGlobalUserName();
  const email = await adapter.getGlobalUserEmail();

  assert.equal(name, 'Sara Loera');
  assert.equal(email, 'sara@example.com');
  assert.deepEqual(calls, [
    { file: 'git', args: ['config', '--global', 'user.name', 'Sara Loera'] },
    { file: 'git', args: ['config', '--global', 'user.email', 'sara@example.com'] },
    { file: 'git', args: ['config', '--global', '--get', 'user.name'] },
    { file: 'git', args: ['config', '--global', '--get', 'user.email'] }
  ]);
});

test('git config adapter raises a clear error when git is missing', async () => {
  const adapter = new SystemGitConfig({
    exec: async () => {
      const error = new Error('spawn git ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
  });

  await assert.rejects(() => adapter.getGlobalUserName(), GitNotInstalledError);
});
