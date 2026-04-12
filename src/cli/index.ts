#!/usr/bin/env node

/*
 * Defines the gitrole CLI commands and wires them to the application layer.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { getDoctorExitCode } from './exit-codes.js';
import {
  addRole,
  doctor,
  getStatus,
  getCurrentRole,
  GitNotInstalledError,
  listRoles,
  NotInGitRepositoryError,
  OriginRemoteNotConfiguredError,
  ProfileNotFoundError,
  removeRole,
  RoleMissingGithubHostError,
  resolveRepoPolicy,
  UnsupportedRemoteRewriteError,
  useRemoteForRole,
  useRole
} from '../application/use-cases/index.js';
import type { AppDependencies, DoctorDependencies } from '../application/contracts.js';
import {
  InvalidRepoPolicyError,
  RepoPolicyNotFoundError,
  RepoPolicyRepositoryContextError
} from '../application/repo-policy.js';
import { SystemGitConfig } from '../adapters/git-config.js';
import { SystemGitRepository } from '../adapters/git-repository.js';
import { FileRoleStore } from '../adapters/role-store.js';
import { SystemSshAgent } from '../adapters/ssh-agent.js';
import { SystemSshAuthProbe } from '../adapters/ssh-auth.js';
import {
  renderCurrentRole,
  renderDoctor,
  renderError,
  renderRepoNote,
  renderRemovedRole,
  renderRemoteUse,
  renderRoleList,
  renderSavedRole,
  renderSshNote,
  renderShortStatus,
  renderStatus,
  renderUsedRole
} from '../interface/renderer.js';

interface Output {
  stdout(message: string): void;
  stderr(message: string): void;
}

const output: Output = {
  stdout(message) {
    process.stdout.write(`${message}\n`);
  },
  stderr(message) {
    process.stderr.write(`${message}\n`);
  }
};

/**
 * Creates the concrete runtime dependencies used by the CLI.
 *
 * @remarks
 * The dependency boundary keeps the command layer small and makes the
 * application behavior testable without touching the real filesystem,
 * Git config, or SSH agent.
 */
export function createDependencies(): AppDependencies {
  return {
    roleStore: new FileRoleStore(),
    gitConfig: new SystemGitConfig(),
    sshAgent: new SystemSshAgent()
  };
}

type CliDependencies = AppDependencies & {
  repository: DoctorDependencies['repository'];
  sshAuthProbe: DoctorDependencies['sshAuthProbe'];
};

function createCliDependencies(): CliDependencies {
  return {
    ...createDependencies(),
    repository: new SystemGitRepository(),
    sshAuthProbe: new SystemSshAuthProbe()
  };
}

/**
 * Builds the Commander program and wires each command to its application use case.
 */
export function createProgram(
  dependencies: CliDependencies = createCliDependencies(),
  io: Output = output
): Command {
  const program = new Command();
  let commandExitCode = 0;

  program
    .name('gitrole')
    .description('Manage named git identities and diagnose repo alignment.')
    .version(getPackageVersion())
    .addHelpText(
      'after',
      `

Examples:
  $ gitrole add work --name "Alex Developer" --email "alex@work.example"
  $ gitrole use work
  $ gitrole use work --local
  $ gitrole resolve
  $ gitrole current
  $ gitrole status
  $ gitrole doctor
  $ gitrole remote set work
`
    );

  program
    .command('add')
    .description('save or update a named role')
    .argument('<name>', 'saved role name')
    .requiredOption('--name <fullName>', 'git user.name value for this role')
    .requiredOption('--email <email>', 'git user.email value for this role')
    .option('--ssh <path>', 'SSH private key to load with ssh-add')
    .option('--github-user <githubUser>', 'expected GitHub user for SSH pushes')
    .option('--github-host <githubHost>', 'expected GitHub SSH host or host alias')
    .addHelpText(
      'after',
      `

Examples:
  $ gitrole add work --name "Alex Developer" --email "alex@work.example"
  $ gitrole add work --name "Alex Developer" --email "alex@work.example" --ssh ~/.ssh/id_work
`
    )
    .action(async (
      name: string,
      options: {
        name: string;
        email: string;
        ssh?: string;
        githubUser?: string;
        githubHost?: string;
      }
    ) => {
      const role = await addRole(dependencies, {
        name,
        fullName: options.name,
        email: options.email,
        sshKeyPath: options.ssh,
        githubUser: options.githubUser,
        githubHost: options.githubHost
      });

      io.stdout(renderSavedRole(role));
    });

  program
    .command('use')
    .description('apply a saved role globally or to the current repo')
    .argument('<name>', 'saved role name')
    .option('--global', 'apply the role to global Git config (default)')
    .option('--local', 'apply the role to repository-local Git config')
    .addHelpText(
      'after',
      `

Scope:
  no flag / --global  apply the role to global Git config
  --local             apply the role only to the current repository; requires a git repo

Notes:
  If the role defines an SSH key, gitrole still loads it with ssh-add.
  If repo alignment issues are detected after the switch, gitrole prints a repo note.

Examples:
  $ gitrole use work
  $ gitrole use work --global
  $ gitrole use work --local
`
    )
    .action(async (name: string, options: { global?: boolean; local?: boolean }) => {
      if (options.global && options.local) {
        throw new Error('choose only one of --global or --local');
      }

      const scope = options.local ? 'local' : 'global';
      const result = await useRole(dependencies, name, { scope });
      io.stdout(renderUsedRole(result));

      if (result.ssh && !result.ssh.ok && result.ssh.message) {
        io.stdout(renderSshNote(result.ssh.message));
      }

      if (result.alignment?.checks.some((check) => check.status === 'warn')) {
        io.stdout(renderRepoNote());
      }
    });

  program
    .command('resolve')
    .description('print the repo-local default role from .gitrole')
    .addHelpText(
      'after',
      `

Repo policy:
  Reads the repository-local ${'.gitrole'} file and prints the configured defaultRole.
  This is identity policy only. It does not switch roles or enforce hooks.

Example:
  $ gitrole resolve
`
    )
    .action(async () => {
      const repoPolicy = await resolveRepoPolicy({
        repository: dependencies.repository
      });
      io.stdout(repoPolicy.defaultRole);
    });

  program
    .command('current')
    .description('show the effective identity')
    .addHelpText(
      'after',
      `

Examples:
  $ gitrole current
`
    )
    .action(async () => {
      const result = await getCurrentRole(dependencies);
      io.stdout(renderCurrentRole(result));
    });

  program.command('list').description('list saved roles and mark the active one').action(async () => {
    const result = await listRoles(dependencies);
    io.stdout(renderRoleList(result));
  });

  program
    .command('status')
    .description('show a quick human-readable alignment check')
    .option('--short', 'show machine-friendly one-line status output')
    .addHelpText(
      'after',
      `

Views:
  default   compact human-readable summary
  --short   stable one-line format for scripts, prompts, and automation

Policy:
  status warns only on actionable mismatches.
  Observed context alone does not degrade the overall result.

Examples:
  $ gitrole status
  $ gitrole status --short
`
    )
    .action(async (options: { short?: boolean }) => {
      const result = await getStatus(dependencies);
      io.stdout(options.short ? renderShortStatus(result) : renderStatus(result));
      commandExitCode = result.overall === 'aligned' ? 0 : 2;
    });

  program
    .command('doctor')
    .description('diagnose identity, remote, and SSH auth alignment')
    .option('--json', 'write the diagnostic result as JSON')
    .addHelpText(
      'after',
      `

Checks:
  - effective git identity
  - repository context and branch
  - origin remote configuration
  - SSH auth alignment for SSH remotes

Policy:
  gitrole warns on violated expectations, not assumptions.
  githubUser checks SSH auth. githubHost checks the remote host.
  Remote owner/repository is context, not a warning by default.

Example:
  $ gitrole doctor
  $ gitrole doctor --json
`
    )
    .action(async (options: { json?: boolean }) => {
      const result = await doctor(dependencies);
      io.stdout(options.json ? JSON.stringify(result, null, 2) : renderDoctor(result));
      commandExitCode = getDoctorExitCode(result);
    });

  const remoteCommand = program
    .command('remote')
    .description('manage repository remotes for a selected role')
    .addHelpText(
      'after',
      `

Use 'gitrole remote set <role>' when the current origin host alias is wrong
for the selected role.
`
    );

  remoteCommand
    .command('set')
    .description("rewrite origin to the role's GitHub host alias")
    .argument('<name>', 'saved role name')
    .addHelpText(
      'after',
      `

Behavior:
  - rewrites the origin host to the role's configured GitHub host alias
  - preserves the observed owner/repository slug
  - intended for SSH remotes

Example:
  $ gitrole remote set work
`
    )
    .action(async (name: string) => {
      const result = await useRemoteForRole(dependencies, name);
      io.stdout(renderRemoteUse(result));
    });

  program
    .command('remove')
    .description('remove a saved role')
    .argument('<name>', 'saved role name')
    .action(async (name: string) => {
      const role = await removeRole(dependencies, name);
      io.stdout(renderRemovedRole(role));
    });

  Reflect.set(program, '__gitroleExitCode', () => commandExitCode);

  return program;
}

function getPackageVersion(): string {
  for (const relativePath of ['../../package.json', '../../../package.json']) {
    try {
      const packageJson = JSON.parse(
        readFileSync(new URL(relativePath, import.meta.url), 'utf8')
      ) as { version?: string };

      if (packageJson.version) {
        return packageJson.version;
      }
    } catch {
      continue;
    }
  }

  return '0.0.0';
}

/**
 * Runs the CLI against the provided argv vector and returns a process exit code.
 *
 * @remarks
 * Success paths return `0`. Operational failures print a user-facing error to
 * stderr and return `1`.
 */
export async function run(argv = process.argv): Promise<number> {
  const program = createProgram();

  try {
    await program.parseAsync(argv);
    const getExitCode = Reflect.get(program, '__gitroleExitCode') as (() => number) | undefined;
    return getExitCode ? getExitCode() : 0;
  } catch (error) {
    output.stderr(renderError(formatError(error)));
    return 1;
  }
}

function formatError(error: unknown): string {
  if (
    error instanceof ProfileNotFoundError ||
    error instanceof GitNotInstalledError ||
    error instanceof NotInGitRepositoryError ||
    error instanceof RepoPolicyRepositoryContextError ||
    error instanceof RepoPolicyNotFoundError ||
    error instanceof InvalidRepoPolicyError ||
    error instanceof RoleMissingGithubHostError ||
    error instanceof OriginRemoteNotConfiguredError ||
    error instanceof UnsupportedRemoteRewriteError
  ) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'unknown error';
}

const isEntrypoint = isDirectExecution(import.meta.url, process.argv[1]);

if (isEntrypoint) {
  run().then((code) => {
    process.exitCode = code;
  });
}

function isDirectExecution(moduleUrl: string, argvEntry?: string): boolean {
  if (!argvEntry) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(argvEntry);
  } catch {
    return false;
  }
}
