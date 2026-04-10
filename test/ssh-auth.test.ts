import test from 'node:test';
import assert from 'node:assert/strict';

import { SystemSshAuthProbe, mapProbeOutput } from '../src/adapters/ssh-auth.js';

test('ssh auth probe extracts the GitHub username from the SSH handshake output', async () => {
  const probe = new SystemSshAuthProbe({
    binaryPath: 'ssh',
    exec: async () => {
      const error = new Error('ssh exited') as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
      };
      error.code = '1';
      error.stderr =
        "Hi synsoftworksdev! You've successfully authenticated, but GitHub does not provide shell access.\n";
      throw error;
    }
  });

  const result = await probe.probeGithubUser('github.com-synsoftworksdev');

  assert.deepEqual(result, {
    ok: true,
    host: 'github.com-synsoftworksdev',
    githubUser: 'synsoftworksdev'
  });
});

test('mapProbeOutput returns a warning result when no GitHub username is present', () => {
  assert.deepEqual(mapProbeOutput('github.com', 'Permission denied (publickey).'), {
    ok: false,
    host: 'github.com',
    message: 'Permission denied (publickey).'
  });
});
