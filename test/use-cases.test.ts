import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCurrentRole,
  useRole,
  type AppDependencies
} from '../src/application/use-cases.js';
import type { Role } from '../src/domain/role.js';

function createDependencies(role: Role): {
  dependencies: AppDependencies;
  calls: { names: string[]; emails: string[]; ssh: string[] };
} {
  const calls = {
    names: [] as string[],
    emails: [] as string[],
    ssh: [] as string[]
  };

  return {
    dependencies: {
      roleStore: {
        async list() {
          return [role];
        },
        async get(name: string) {
          return name === role.name ? role : undefined;
        },
        async save() {
          return undefined;
        },
        async remove() {
          return true;
        }
      },
      gitConfig: {
        async getGlobalUserName() {
          return role.fullName;
        },
        async getGlobalUserEmail() {
          return role.email;
        },
        async setGlobalUserName(name: string) {
          calls.names.push(name);
        },
        async setGlobalUserEmail(email: string) {
          calls.emails.push(email);
        }
      },
      sshAgent: {
        async loadKey(path: string) {
          calls.ssh.push(path);
          return { ok: true };
        }
      }
    },
    calls
  };
}

test('use-role applies the selected git identity', async () => {
  const role: Role = {
    name: 'sara',
    fullName: 'Sara Loera',
    email: 'sara@example.com',
    sshKeyPath: '/tmp/id_sara'
  };
  const { dependencies, calls } = createDependencies(role);

  const result = await useRole(dependencies, 'sara');

  assert.equal(result.role.name, 'sara');
  assert.deepEqual(calls.names, ['Sara Loera']);
  assert.deepEqual(calls.emails, ['sara@example.com']);
  assert.deepEqual(calls.ssh, ['/tmp/id_sara']);
});

test('current-role matches the active identity against saved roles', async () => {
  const role: Role = {
    name: 'sara',
    fullName: 'Sara Loera',
    email: 'sara@example.com'
  };
  const { dependencies } = createDependencies(role);

  const result = await getCurrentRole(dependencies);

  assert.equal(result.role?.name, 'sara');
  assert.equal(result.identity.fullName, 'Sara Loera');
  assert.equal(result.identity.email, 'sara@example.com');
});
