import test from 'node:test';
import assert from 'node:assert/strict';

import {
  doctor,
  getCurrentRole,
  getStatus,
  NotInGitRepositoryError,
  useRemoteForRole,
  useRole,
  verify
} from '../src/application/use-cases/index.js';
import type { AppDependencies, DoctorDependencies } from '../src/application/contracts.js';
import { parseRemoteUrl } from '../src/adapters/git-repository.js';
import type { Role } from '../src/domain/role.js';

function getOriginRemote(url?: string) {
  return url ? parseRemoteUrl('origin', url) : undefined;
}

function createDependencies(role: Role): {
  dependencies: AppDependencies;
  calls: { names: string[]; emails: string[]; localNames: string[]; localEmails: string[]; ssh: string[] };
} {
  const calls = {
    names: [] as string[],
    emails: [] as string[],
    localNames: [] as string[],
    localEmails: [] as string[],
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
  assert.equal(result.scope, 'global');
  assert.deepEqual(calls.names, ['Sara Loera']);
  assert.deepEqual(calls.emails, ['sara@example.com']);
  assert.deepEqual(calls.localNames, []);
  assert.deepEqual(calls.localEmails, []);
  assert.deepEqual(calls.ssh, ['/tmp/id_sara']);
});

test('use-role can apply the selected git identity to local repository config', async () => {
  const role: Role = {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example'
  };
  const { dependencies, calls } = createDependencies(role);

  const result = await useRole(
    {
      ...dependencies,
      repository: {
        async isInsideWorkTree() {
          return true;
        },
        async hasCommits() {
          return true;
        },
        async getLatestNonMergeCommit() {
          return {
            sha: 'abc123',
            authorName: 'Alex Developer',
            authorEmail: 'alex@work.example',
            subject: 'feat: test local scope'
          };
        },
        async getTopLevelPath() {
          return '/tmp/gitrole';
        },
        async getCurrentBranch() {
          return 'main';
        },
        async getUpstreamBranch() {
          return 'origin/main';
        },
        async getOriginUrl() {
          return 'git@github.com-acme-dev:acme-dev/gitrole.git';
        },
        async getOriginRemote() {
          return getOriginRemote('git@github.com-acme-dev:acme-dev/gitrole.git');
        },
        async setOriginUrl() {
          return undefined;
        },
        async getLocalUserName() {
          return role.fullName;
        },
        async getLocalUserEmail() {
          return role.email;
        },
        async setLocalUserName(name: string) {
          calls.localNames.push(name);
        },
        async setLocalUserEmail(email: string) {
          calls.localEmails.push(email);
        }
      },
      sshAuthProbe: {
        async probeGithubUser() {
          return {
            ok: true,
            host: 'github.com-acme-dev',
            githubUser: 'acme-dev'
          };
        }
      }
    },
    'work',
    { scope: 'local' }
  );

  assert.equal(result.scope, 'local');
  assert.deepEqual(calls.names, []);
  assert.deepEqual(calls.emails, []);
  assert.deepEqual(calls.localNames, ['Alex Developer']);
  assert.deepEqual(calls.localEmails, ['alex@work.example']);
});

test('use-role rejects local scope outside a git repository', async () => {
  const role: Role = {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example'
  };
  const { dependencies } = createDependencies(role);

  await assert.rejects(
    () =>
      useRole(
        {
          ...dependencies,
          repository: {
            async isInsideWorkTree() {
              return false;
            },
        async hasCommits() {
          return false;
        },
        async getLatestNonMergeCommit() {
          return undefined;
        },
        async getTopLevelPath() {
          return undefined;
            },
            async getCurrentBranch() {
              return undefined;
            },
            async getUpstreamBranch() {
              return undefined;
            },
            async getOriginUrl() {
              return undefined;
            },
            async getOriginRemote() {
              return undefined;
            },
            async setOriginUrl() {
              return undefined;
            },
            async getLocalUserName() {
              return undefined;
            },
            async getLocalUserEmail() {
              return undefined;
            },
            async setLocalUserName() {
              return undefined;
            },
            async setLocalUserEmail() {
              return undefined;
            }
          }
        },
        'work',
        { scope: 'local' }
      ),
    NotInGitRepositoryError
  );
});

test('use-role returns repo-aware warnings when the selected role does not match the repo path', async () => {
  const role: Role = {
    name: 'work',
    fullName: 'Sara Loera',
    email: 'sara@synthesissoftworks.com',
    githubUser: 'synsoftworksdev',
    githubHost: 'github.com-synsoftworksdev'
  };
  const { dependencies } = createDependencies(role);

  const result = await useRole(
    {
      ...dependencies,
      repository: {
        async isInsideWorkTree() {
          return true;
        },
        async hasCommits() {
          return true;
        },
        async getLatestNonMergeCommit() {
          return undefined;
        },
        async getTopLevelPath() {
          return '/tmp/gitrole';
        },
        async getCurrentBranch() {
          return 'main';
        },
        async getUpstreamBranch() {
          return 'origin/main';
        },
        async getOriginUrl() {
          return 'git@github.com-saraeloop:synsoftworksdev/gitrole.git';
        },
        async getOriginRemote() {
          return getOriginRemote('git@github.com-saraeloop:synsoftworksdev/gitrole.git');
        },
        async setOriginUrl() {
          return undefined;
        },
        async getLocalUserName() {
          return undefined;
        },
        async getLocalUserEmail() {
          return undefined;
        },
        async setLocalUserName() {
          return undefined;
        },
        async setLocalUserEmail() {
          return undefined;
        }
      },
      sshAuthProbe: {
        async probeGithubUser() {
          return {
            ok: true,
            host: 'github.com-saraeloop',
            githubUser: 'saraeloop'
          };
        }
      }
    },
    'work'
  );

  assert.equal(result.alignment?.checks.some((check) => check.status === 'warn'), true);
  assert.equal(
    result.alignment?.checks.some(
      (check) =>
        check.label === 'auth' && check.message.includes('expected synsoftworksdev')
    ),
    true
  );
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

test('current-role prefers the effective local identity when a repo-local override is active', async () => {
  const globalRole: Role = {
    name: 'personal',
    fullName: 'Sara Personal',
    email: 'sara@personal.example'
  };
  const localRole: Role = {
    name: 'work',
    fullName: 'Synthesis Softworks',
    email: 'dev@synthesissoftworks.com'
  };
  const { dependencies } = createDependencies(globalRole);

  const result = await getCurrentRole({
    ...dependencies,
    roleStore: {
      async list() {
        return [globalRole, localRole];
      },
      async get(name: string) {
        return [globalRole, localRole].find((role) => role.name === name);
      },
      async save() {
        return undefined;
      },
      async remove() {
        return true;
      }
    },
    repository: {
      async getLocalUserName() {
        return localRole.fullName;
      },
      async getLocalUserEmail() {
        return localRole.email;
      }
    }
  });

  assert.equal(result.role?.name, 'work');
  assert.equal(result.identity.fullName, 'Synthesis Softworks');
  assert.equal(result.identity.email, 'dev@synthesissoftworks.com');
});

test('doctor aligns commit identity, remote metadata, and SSH auth', async () => {
  const role: Role = {
    name: 'work',
    fullName: 'Sara Loera',
    email: 'sara@synthesissoftworks.com',
    sshKeyPath: '~/.ssh/id_ed25519_synsoftworksdev',
    githubUser: 'synsoftworksdev',
    githubHost: 'github.com-synsoftworksdev'
  };
  const dependencies: DoctorDependencies = {
    roleStore: {
      async list() {
        return [role];
      },
      async get() {
        return role;
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
      async setGlobalUserName() {
        return undefined;
      },
      async setGlobalUserEmail() {
        return undefined;
      }
    },
    repository: {
      async isInsideWorkTree() {
        return true;
      },
      async hasCommits() {
        return true;
      },
      async getLatestNonMergeCommit() {
        return {
          sha: 'abc123',
          authorName: 'Sara Loera',
          authorEmail: 'sara@synthesissoftworks.com',
          subject: 'feat: align identity'
        };
      },
      async getTopLevelPath() {
        return '/tmp/gitrole';
      },
      async getCurrentBranch() {
        return 'main';
      },
      async getUpstreamBranch() {
        return 'origin/main';
      },
      async getOriginUrl() {
        return 'git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git';
      },
      async getOriginRemote() {
        return getOriginRemote('git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git');
      },
      async setOriginUrl() {
        return undefined;
      },
      async getLocalUserName() {
        return undefined;
      },
      async getLocalUserEmail() {
        return undefined;
      },
      async setLocalUserName() {
        return undefined;
      },
      async setLocalUserEmail() {
        return undefined;
      }
    },
    sshAuthProbe: {
      async probeGithubUser(host: string) {
        assert.equal(host, 'github.com-synsoftworksdev');
        return {
          ok: true,
          host,
          githubUser: 'synsoftworksdev'
        };
      }
    }
  };

  const result = await doctor(dependencies);

  assert.equal(result.role?.name, 'work');
  assert.equal(result.overall, 'aligned');
  assert.equal(result.commitIdentity.fullName.source, 'global');
  assert.equal(result.repository.remote?.owner, 'synsoftworksdev');
  assert.equal(result.sshAuth?.githubUser, 'synsoftworksdev');
  assert.equal(result.checks.some((check) => check.status === 'warn'), false);
  assert.equal(result.checks.some((check) => check.label === 'identity'), false);

  const status = await getStatus(dependencies);
  assert.equal(status.roleName, 'work');
  assert.equal(status.commitIdentity, 'Sara Loera <sara@synthesissoftworks.com>');
  assert.equal(status.scope, 'global');
  assert.equal(status.localOverride, false);
  assert.deepEqual(status.lastNonMergeCommit, {
    sha: 'abc123',
    authorName: 'Sara Loera',
    authorEmail: 'sara@synthesissoftworks.com',
    subject: 'feat: align identity'
  });
  assert.equal(status.overall, 'aligned');
  assert.equal(status.commit, 'ok');
  assert.equal(status.remote, 'ok');
  assert.equal(status.auth, 'ok');

  const verification = await verify(dependencies);
  assert.equal(verification.roleName, 'work');
  assert.equal(verification.identity, 'Sara Loera <sara@synthesissoftworks.com>');
  assert.equal(verification.nextCommit, 'Sara Loera <sara@synthesissoftworks.com>');
  assert.equal(verification.scope, 'global');
  assert.equal(verification.overall, 'aligned');
});

test('doctor reports local scope when repo-local identity overrides are active', async () => {
  const role: Role = {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example',
    githubUser: 'acme-dev',
    githubHost: 'github.com-acme-dev'
  };
  const dependencies: DoctorDependencies = {
    roleStore: {
      async list() {
        return [role];
      },
      async get() {
        return role;
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
        return 'Pat Person';
      },
      async getGlobalUserEmail() {
        return 'pat@personal.example';
      },
      async setGlobalUserName() {
        return undefined;
      },
      async setGlobalUserEmail() {
        return undefined;
      }
    },
    repository: {
      async isInsideWorkTree() {
        return true;
      },
      async hasCommits() {
        return true;
      },
      async getLatestNonMergeCommit() {
        return {
          sha: 'abc123',
          authorName: 'Alex Developer',
          authorEmail: 'alex@work.example',
          subject: 'feat: local alignment'
        };
      },
      async getTopLevelPath() {
        return '/tmp/gitrole';
      },
      async getCurrentBranch() {
        return 'main';
      },
      async getUpstreamBranch() {
        return 'origin/main';
      },
      async getOriginUrl() {
        return 'git@github.com-acme-dev:acme-dev/gitrole.git';
      },
      async getOriginRemote() {
        return getOriginRemote('git@github.com-acme-dev:acme-dev/gitrole.git');
      },
      async setOriginUrl() {
        return undefined;
      },
      async getLocalUserName() {
        return role.fullName;
      },
      async getLocalUserEmail() {
        return role.email;
      },
      async setLocalUserName() {
        return undefined;
      },
      async setLocalUserEmail() {
        return undefined;
      }
    },
    sshAuthProbe: {
      async probeGithubUser() {
        return {
          ok: true,
          host: 'github.com-acme-dev',
          githubUser: 'acme-dev'
        };
      }
    }
  };

  const result = await doctor(dependencies);
  const status = await getStatus(dependencies);

  assert.equal(result.overall, 'aligned');
  assert.equal(result.scope.effective, 'local');
  assert.equal(result.scope.hasLocalOverride, true);
  assert.equal(
    result.checks.some(
      (check) =>
        check.label === 'scope' &&
        check.message.includes('selected role work is applied via local config')
    ),
    true
  );
  assert.equal(status.scope, 'local');
  assert.equal(status.localOverride, true);
  assert.equal(status.lastNonMergeCommit?.authorName, 'Alex Developer');
  assert.equal(status.overall, 'aligned');
});

test('doctor warns when HTTPS remotes prevent SSH auth verification', async () => {
  const role: Role = {
    name: 'work',
    fullName: 'Sara Loera',
    email: 'sara@synthesissoftworks.com',
    githubUser: 'synsoftworksdev'
  };
  const dependencies: DoctorDependencies = {
    roleStore: {
      async list() {
        return [role];
      },
      async get() {
        return role;
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
      async setGlobalUserName() {
        return undefined;
      },
      async setGlobalUserEmail() {
        return undefined;
      }
    },
    repository: {
      async isInsideWorkTree() {
        return true;
      },
      async hasCommits() {
        return false;
      },
      async getLatestNonMergeCommit() {
        return undefined;
      },
      async getTopLevelPath() {
        return '/tmp/gitrole';
      },
      async getCurrentBranch() {
        return 'main';
      },
      async getUpstreamBranch() {
        return 'origin/main';
      },
      async getOriginUrl() {
        return 'https://github.com/synsoftworksdev/gitrole.git';
      },
      async getOriginRemote() {
        return getOriginRemote('https://github.com/synsoftworksdev/gitrole.git');
      },
      async setOriginUrl() {
        return undefined;
      },
      async getLocalUserName() {
        return undefined;
      },
      async getLocalUserEmail() {
        return undefined;
      },
      async setLocalUserName() {
        return undefined;
      },
      async setLocalUserEmail() {
        return undefined;
      }
    },
    sshAuthProbe: {
      async probeGithubUser() {
        throw new Error('should not probe ssh for https remotes');
      }
    }
  };

  const result = await doctor(dependencies);

  assert.equal(result.repository.remote?.protocol, 'https');
  assert.equal(result.overall, 'warning');
  assert.equal(
    result.checks.some(
      (check) =>
        check.label === 'auth' &&
        check.message.includes('cannot verify GitHub SSH auth identity')
    ),
    true
  );
  assert.equal(
    result.checks.some(
      (check) =>
        check.label === 'history' &&
        check.message.includes('repository has no commits yet')
    ),
    true
  );
});

test('useRemoteForRole rewrites origin to the role host alias', async () => {
  const role: Role = {
    name: 'work',
    fullName: 'Sara Loera',
    email: 'sara@synthesissoftworks.com',
    githubHost: 'github.com-synsoftworksdev'
  };
  const calls: string[] = [];

  const result = await useRemoteForRole(
    {
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
      repository: {
        async isInsideWorkTree() {
          return true;
        },
        async hasCommits() {
          return true;
        },
        async getLatestNonMergeCommit() {
          return undefined;
        },
        async getTopLevelPath() {
          return '/tmp/gitrole';
        },
        async getCurrentBranch() {
          return 'main';
        },
        async getUpstreamBranch() {
          return 'origin/main';
        },
        async getOriginUrl() {
          return 'git@github.com:synsoftworksdev/gitrole.git';
        },
        async getOriginRemote() {
          return getOriginRemote('git@github.com:synsoftworksdev/gitrole.git');
        },
        async setOriginUrl(url: string) {
          calls.push(url);
        },
        async getLocalUserName() {
          return undefined;
        },
        async getLocalUserEmail() {
          return undefined;
        },
        async setLocalUserName() {
          return undefined;
        },
        async setLocalUserEmail() {
          return undefined;
        }
      }
    },
    'work'
  );

  assert.equal(result.nextUrl, 'git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git');
  assert.deepEqual(calls, ['git@github.com-synsoftworksdev:synsoftworksdev/gitrole.git']);
});

test('doctor adds a fix hint when no saved role matches the active commit identity', async () => {
  const role: Role = {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example',
    githubUser: 'acme-dev'
  };
  const dependencies: DoctorDependencies = {
    roleStore: {
      async list() {
        return [role];
      },
      async get() {
        return role;
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
        return 'Pat Person';
      },
      async getGlobalUserEmail() {
        return 'pat@personal.example';
      },
      async setGlobalUserName() {
        return undefined;
      },
      async setGlobalUserEmail() {
        return undefined;
      }
    },
    repository: {
      async isInsideWorkTree() {
        return true;
      },
      async hasCommits() {
        return true;
      },
      async getLatestNonMergeCommit() {
        return {
          sha: 'abc123',
          authorName: 'Pat Person',
          authorEmail: 'pat@personal.example',
          subject: 'feat: previous personal commit'
        };
      },
      async getTopLevelPath() {
        return '/tmp/gitrole';
      },
      async getCurrentBranch() {
        return 'main';
      },
      async getUpstreamBranch() {
        return 'origin/main';
      },
      async getOriginUrl() {
        return 'git@github.com-acme-dev:acme-dev/gitrole.git';
      },
      async getOriginRemote() {
        return getOriginRemote('git@github.com-acme-dev:acme-dev/gitrole.git');
      },
      async setOriginUrl() {
        return undefined;
      },
      async getLocalUserName() {
        return undefined;
      },
      async getLocalUserEmail() {
        return undefined;
      },
      async setLocalUserName() {
        return undefined;
      },
      async setLocalUserEmail() {
        return undefined;
      }
    },
    sshAuthProbe: {
      async probeGithubUser() {
        return {
          ok: true,
          host: 'github.com-acme-dev',
          githubUser: 'acme-dev'
        };
      }
    }
  };

  const result = await doctor(dependencies);

  assert.equal(result.role, undefined);
  assert.equal(result.overall, 'warning');
  assert.equal(
    result.checks.some(
      (check) =>
        check.label === 'identity' &&
        check.message.includes('SSH auth resolves to acme-dev')
    ),
    true
  );
  assert.equal(
    result.checks.some(
      (check) =>
        check.label === 'fix' &&
        check.message.includes('switch to the intended saved role before committing')
    ),
    true
  );

  const status = await getStatus(dependencies);
  assert.equal(status.roleName, 'no-role');
  assert.equal(status.scope, 'global');
  assert.equal(status.localOverride, false);
  assert.equal(status.lastNonMergeCommit?.authorName, 'Pat Person');
  assert.equal(status.overall, 'warning');
  assert.equal(status.commit, 'warn');
  assert.equal(status.remote, 'ok');
  assert.equal(status.auth, 'ok');
});

test('verify stays aligned when no non-merge commit exists but effective identity is configured', async () => {
  const role: Role = {
    name: 'work',
    fullName: 'Alex Developer',
    email: 'alex@work.example'
  };
  const dependencies: DoctorDependencies = {
    roleStore: {
      async list() {
        return [role];
      },
      async get() {
        return role;
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
      async setGlobalUserName() {
        return undefined;
      },
      async setGlobalUserEmail() {
        return undefined;
      }
    },
    repository: {
      async isInsideWorkTree() {
        return true;
      },
      async hasCommits() {
        return false;
      },
      async getLatestNonMergeCommit() {
        return undefined;
      },
      async getTopLevelPath() {
        return '/tmp/gitrole';
      },
      async getCurrentBranch() {
        return 'main';
      },
      async getUpstreamBranch() {
        return 'origin/main';
      },
      async getOriginUrl() {
        return 'git@github.com-acme-dev:acme-dev/gitrole.git';
      },
      async getOriginRemote() {
        return getOriginRemote('git@github.com-acme-dev:acme-dev/gitrole.git');
      },
      async setOriginUrl() {
        return undefined;
      },
      async getLocalUserName() {
        return undefined;
      },
      async getLocalUserEmail() {
        return undefined;
      },
      async setLocalUserName() {
        return undefined;
      },
      async setLocalUserEmail() {
        return undefined;
      }
    },
    sshAuthProbe: {
      async probeGithubUser() {
        return {
          ok: true,
          host: 'github.com-acme-dev',
          githubUser: 'acme-dev'
        };
      }
    }
  };

  const result = await verify(dependencies);

  assert.equal(result.identity, 'Alex Developer <alex@work.example>');
  assert.equal(result.lastNonMergeCommit, undefined);
  assert.equal(result.overall, 'aligned');
});

test('verify warns when the latest non-merge commit author differs from the effective identity', async () => {
  const role: Role = {
    name: 'saraeloop',
    fullName: 'Sara Loera',
    email: 'saraeloop@gmail.com'
  };
  const dependencies: DoctorDependencies = {
    roleStore: {
      async list() {
        return [role];
      },
      async get() {
        return role;
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
      async setGlobalUserName() {
        return undefined;
      },
      async setGlobalUserEmail() {
        return undefined;
      }
    },
    repository: {
      async isInsideWorkTree() {
        return true;
      },
      async hasCommits() {
        return true;
      },
      async getLatestNonMergeCommit() {
        return {
          sha: 'abc123',
          authorName: 'Synthesis Softworks',
          authorEmail: 'dev@synthesissoftworks.com',
          subject: 'feat: previous commit'
        };
      },
      async getTopLevelPath() {
        return '/tmp/gitrole';
      },
      async getCurrentBranch() {
        return 'main';
      },
      async getUpstreamBranch() {
        return 'origin/main';
      },
      async getOriginUrl() {
        return 'git@github.com-saraeloop:saraeloop/gitrole.git';
      },
      async getOriginRemote() {
        return getOriginRemote('git@github.com-saraeloop:saraeloop/gitrole.git');
      },
      async setOriginUrl() {
        return undefined;
      },
      async getLocalUserName() {
        return undefined;
      },
      async getLocalUserEmail() {
        return undefined;
      },
      async setLocalUserName() {
        return undefined;
      },
      async setLocalUserEmail() {
        return undefined;
      }
    },
    sshAuthProbe: {
      async probeGithubUser() {
        return {
          ok: true,
          host: 'github.com-saraeloop',
          githubUser: 'saraeloop'
        };
      }
    }
  };

  const result = await verify(dependencies);
  const status = await getStatus(dependencies);

  assert.equal(result.overall, 'warning');
  assert.equal(result.lastNonMergeCommit?.authorName, 'Synthesis Softworks');
  assert.equal(status.overall, 'warning');
});
