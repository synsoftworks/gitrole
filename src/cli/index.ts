#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import {
  addRole,
  doctor,
  getDoctorExitCode,
  getStatus,
  type DoctorDependencies,
  getCurrentRole,
  GitNotInstalledError,
  listRoles,
  NotInGitRepositoryError,
  OriginRemoteNotConfiguredError,
  ProfileNotFoundError,
  removeRole,
  RoleMissingGithubHostError,
  UnsupportedRemoteRewriteError,
  type AppDependencies,
  useRemoteForRole,
  useRole
} from '../application/use-cases.js';
import { SystemGitConfig } from '../adapters/git-config.js';
import { SystemGitRepository } from '../adapters/git-repository.js';
import { FileRoleStore } from '../adapters/role-store.js';
import { SystemSshAgent } from '../adapters/ssh-agent.js';
import { SystemSshAuthProbe } from '../adapters/ssh-auth.js';
import {
  renderCurrentRole,
  renderDoctor,
  renderError,
  renderRemovedRole,
  renderRemoteUse,
  renderRoleList,
  renderSavedRole,
  renderShortStatus,
  renderStatus,
  renderUsedRole,
  renderWarning
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
    .version('0.2.0')
    .addHelpText(
      'after',
      `

Examples:
  $ gitrole add work --name "Alex Developer" --email "alex@work.example"
  $ gitrole use work
  $ gitrole use work --local
  $ gitrole status
  $ gitrole current --verbose
  $ gitrole remote use work
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
        io.stderr(renderWarning(result.ssh.message));
      }

      for (const check of result.alignment?.checks ?? []) {
        if (check.status === 'warn') {
          io.stderr(renderWarning(check.message));
        }
      }
    });

  program
    .command('current')
    .description('show the active role or verbose repo diagnostics')
    .option('--verbose', 'show effective identity plus repo and auth diagnostics')
    .addHelpText(
      'after',
      `

Examples:
  $ gitrole current
  $ gitrole current --verbose
`
    )
    .action(async (options: { verbose?: boolean }) => {
      if (options.verbose) {
        const result = await doctor(dependencies);
        io.stdout(renderDoctor(result, 'current'));
        commandExitCode = getDoctorExitCode(result);
        return;
      }

      const result = await getCurrentRole(dependencies);
      io.stdout(renderCurrentRole(result));
    });

  program.command('list').description('list saved roles and mark the active one').action(async () => {
    const result = await listRoles(dependencies);
    io.stdout(renderRoleList(result));
  });

  program
    .command('status')
    .description('show a compact alignment summary')
    .option('--short', 'show machine-friendly one-line status output')
    .addHelpText(
      'after',
      `

Views:
  default   compact human-readable summary
  --short   stable one-line format for scripts, prompts, and automation

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
    .addHelpText(
      'after',
      `

Checks:
  - effective git identity
  - repository context and branch
  - origin remote configuration
  - SSH auth alignment for SSH remotes

Example:
  $ gitrole doctor
`
    )
    .action(async () => {
      const result = await doctor(dependencies);
      io.stdout(renderDoctor(result));
      commandExitCode = getDoctorExitCode(result);
    });

  const remoteCommand = program
    .command('remote')
    .description('manage repository remotes for a selected role')
    .addHelpText(
      'after',
      `

Use 'gitrole remote use <role>' when the current origin host alias is wrong
for the selected role.
`
    );

  remoteCommand
    .command('use')
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
  $ gitrole remote use work
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

/**
 * Runs the CLI against the provided argv vector and returns a process exit code.
 *
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
