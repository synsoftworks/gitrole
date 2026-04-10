#!/usr/bin/env node

import { Command } from 'commander';

import {
  addRole,
  getCurrentRole,
  GitNotInstalledError,
  listRoles,
  ProfileNotFoundError,
  removeRole,
  type AppDependencies,
  useRole
} from '../application/use-cases.js';
import { SystemGitConfig } from '../adapters/git-config.js';
import { FileRoleStore } from '../adapters/role-store.js';
import { SystemSshAgent } from '../adapters/ssh-agent.js';
import {
  renderCurrentRole,
  renderError,
  renderRemovedRole,
  renderRoleList,
  renderSavedRole,
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

/**
 * Builds the Commander program and wires each command to its application use case.
 */
export function createProgram(
  dependencies: AppDependencies = createDependencies(),
  io: Output = output
): Command {
  const program = new Command();

  program
    .name('gitrole')
    .description('Switch your full git identity in one command.')
    .version('0.1.0');

  program
    .command('add')
    .argument('<name>', 'role name')
    .requiredOption('--name <fullName>', 'git user.name value')
    .requiredOption('--email <email>', 'git user.email value')
    .option('--ssh <path>', 'ssh private key to load with ssh-add')
    .action(async (name: string, options: { name: string; email: string; ssh?: string }) => {
      const role = await addRole(dependencies, {
        name,
        fullName: options.name,
        email: options.email,
        sshKeyPath: options.ssh
      });

      io.stdout(renderSavedRole(role));
    });

  program.command('use').argument('<name>', 'role name').action(async (name: string) => {
    const result = await useRole(dependencies, name);
    io.stdout(renderUsedRole(result));

    if (result.ssh && !result.ssh.ok && result.ssh.message) {
      io.stderr(renderWarning(result.ssh.message));
    }
  });

  program.command('current').action(async () => {
    const result = await getCurrentRole(dependencies);
    io.stdout(renderCurrentRole(result));
  });

  program.command('list').action(async () => {
    const result = await listRoles(dependencies);
    io.stdout(renderRoleList(result));
  });

  program.command('remove').argument('<name>', 'role name').action(async (name: string) => {
    const role = await removeRole(dependencies, name);
    io.stdout(renderRemovedRole(role));
  });

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
    return 0;
  } catch (error) {
    output.stderr(renderError(formatError(error)));
    return 1;
  }
}

function formatError(error: unknown): string {
  if (error instanceof ProfileNotFoundError || error instanceof GitNotInstalledError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'unknown error';
}

const isEntrypoint = import.meta.url === new URL(process.argv[1], 'file://').href;

if (isEntrypoint) {
  run().then((code) => {
    process.exitCode = code;
  });
}
