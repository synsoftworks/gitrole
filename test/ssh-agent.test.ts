/*
 * Covers ssh-add execution and home-directory expansion for stored key paths.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';

import { SystemSshAgent, expandHomePath } from '../src/adapters/ssh-agent.js';

test('expandHomePath expands ~ for ssh key paths', () => {
  assert.equal(expandHomePath('~/.ssh/id_work', '/Users/sara'), '/Users/sara/.ssh/id_work');
  assert.equal(expandHomePath('~', '/Users/sara'), '/Users/sara');
  assert.equal(expandHomePath('/tmp/id_work', '/Users/sara'), '/tmp/id_work');
});

test('ssh agent expands home paths before calling ssh-add', async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const agent = new SystemSshAgent({
    binaryPath: 'ssh-add',
    exec: async (file, args) => {
      calls.push({ file, args });
      return { stdout: '', stderr: '' };
    }
  });

  await agent.loadKey('~/.ssh/id_work');

  assert.deepEqual(calls, [
    {
      file: 'ssh-add',
      args: [`${os.homedir()}/.ssh/id_work`]
    }
  ]);
});
