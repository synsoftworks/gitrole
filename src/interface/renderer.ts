import os from 'node:os';

import chalk from 'chalk';

import type {
  CurrentRoleResult,
  DoctorResult,
  ListRolesResult,
  RemoteUseResult,
  StatusResult,
  UseRoleResult
} from '../application/use-cases.js';
import type { Role } from '../domain/role.js';

export function renderSavedRole(role: Role): string {
  const lines = [
    `${chalk.green('saved')} ${chalk.bold(role.name)}`,
    formatDetail('name', role.fullName),
    formatDetail('email', role.email)
  ];

  if (role.sshKeyPath) {
    lines.push(formatDetail('ssh', formatPath(role.sshKeyPath)));
  }

  if (role.githubUser) {
    lines.push(formatDetail('gh', role.githubUser));
  }

  if (role.githubHost) {
    lines.push(formatDetail('host', role.githubHost));
  }

  return lines.join('\n');
}

export function renderUsedRole(result: UseRoleResult): string {
  const lines = [
    `${chalk.green('switched to')} ${chalk.bold(result.role.name)}`,
    formatDetail('name', result.role.fullName),
    formatDetail('email', result.role.email)
  ];

  if (result.ssh) {
    const status = result.ssh.ok ? ` (${chalk.green('loaded')})` : '';
    lines.push(formatDetail('ssh', `${formatPath(result.ssh.path)}${status}`));
  }

  if (result.role.githubUser) {
    lines.push(formatDetail('gh', result.role.githubUser));
  }

  if (result.role.githubHost) {
    lines.push(formatDetail('host', result.role.githubHost));
  }

  return lines.join('\n');
}

export function renderCurrentRole(result: CurrentRoleResult): string {
  if (result.role) {
    const lines = [
      `${chalk.green('current role')} ${chalk.bold(result.role.name)}`,
      formatDetail('name', result.role.fullName),
      formatDetail('email', result.role.email)
    ];

    if (result.role.sshKeyPath) {
      lines.push(formatDetail('ssh', formatPath(result.role.sshKeyPath)));
    }

    if (result.role.githubUser) {
      lines.push(formatDetail('gh', result.role.githubUser));
    }

    if (result.role.githubHost) {
      lines.push(formatDetail('host', result.role.githubHost));
    }

    return lines.join('\n');
  }

  return [
    chalk.yellow('no matching role'),
    formatDetail('name', result.identity.fullName ?? chalk.dim('not set')),
    formatDetail('email', result.identity.email ?? chalk.dim('not set'))
  ].join('\n');
}

export function renderRoleList(result: ListRolesResult): string {
  if (result.roles.length === 0) {
    return chalk.dim('no saved roles');
  }

  return result.roles
    .map((role) => {
      const marker = role.name === result.activeRoleName ? chalk.green('*') : ' ';
      const ssh = role.sshKeyPath ? ` ${chalk.dim(formatPath(role.sshKeyPath))}` : '';
      const githubUser = role.githubUser ? ` ${chalk.dim(`gh:${role.githubUser}`)}` : '';
      const githubHost = role.githubHost ? ` ${chalk.dim(`host:${role.githubHost}`)}` : '';

      return `${marker} ${chalk.bold(role.name)} ${chalk.dim(
        `${role.fullName} <${role.email}>`
      )}${ssh}${githubUser}${githubHost}`;
    })
    .join('\n');
}

export function renderRemovedRole(role: Role): string {
  return `${chalk.green('removed')} ${chalk.bold(role.name)}`;
}

export function renderWarning(message: string): string {
  return `${chalk.yellow('warning:')} ${message}`;
}

export function renderError(message: string): string {
  return `${chalk.red('error:')} ${message}`;
}

export function renderRemoteUse(result: RemoteUseResult): string {
  return [
    `${chalk.green('updated remote')} ${chalk.bold('origin')} ${chalk.dim(`for ${result.role.name}`)}`,
    formatDetail('from', result.previousUrl),
    formatDetail('to', result.nextUrl)
  ].join('\n');
}

export function renderStatus(result: StatusResult): string {
  const summary =
    result.overall === 'aligned' ? chalk.green(result.overall) : chalk.yellow(result.overall);

  return [
    chalk.bold(result.roleName),
    result.commitIdentity ?? chalk.dim('commit identity unset'),
    summary
  ].join('  ');
}

export function renderShortStatus(result: StatusResult): string {
  return [
    `role=${result.roleName}`,
    `commit=${result.commit}`,
    `remote=${result.remote}`,
    `auth=${result.auth}`,
    `overall=${result.overall}`
  ].join(' ');
}

export function renderDoctor(result: DoctorResult, title = 'doctor'): string {
  const lines = [
    chalk.bold(title),
    formatDetail('role', result.role?.name ?? chalk.yellow('no matching role')),
    formatDetail('name', formatDiagnosedValue(result.commitIdentity.fullName)),
    formatDetail('email', formatDiagnosedValue(result.commitIdentity.email))
  ];

  if (result.role?.githubUser) {
    lines.push(formatDetail('gh', result.role.githubUser));
  }

  if (result.role?.githubHost) {
    lines.push(formatDetail('host', result.role.githubHost));
  }

  if (result.repository.isInsideWorkTree) {
    lines.push(formatDetail('repo', result.repository.topLevelPath ?? 'current directory'));

    if (result.repository.currentBranch) {
      lines.push(formatDetail('branch', result.repository.currentBranch));
    }

    if (result.repository.hasCommits === false) {
      lines.push(formatDetail('history', chalk.yellow('no commits yet')));
    }

    if (result.repository.upstreamBranch) {
      lines.push(formatDetail('upstream', result.repository.upstreamBranch));
    }

    if (result.repository.remote) {
      lines.push(formatDetail('remote', result.repository.remote.url));

      if (result.repository.remote.host) {
        lines.push(formatDetail('rhost', result.repository.remote.host));
      }

      if (result.repository.remote.owner && result.repository.remote.repository) {
        lines.push(
          formatDetail(
            'rrepo',
            `${result.repository.remote.owner}/${result.repository.remote.repository}`
          )
        );
      }
    } else {
      lines.push(formatDetail('remote', chalk.yellow('origin not configured')));
    }
  } else {
    lines.push(formatDetail('repo', chalk.yellow('not a git repository')));
  }

  if (result.sshAuth?.githubUser) {
    lines.push(formatDetail('auth', `${result.sshAuth.githubUser} via ${result.sshAuth.host}`));
  } else if (result.sshAuth?.message) {
    lines.push(formatDetail('auth', chalk.yellow(result.sshAuth.message)));
  }

  lines.push('');
  lines.push(chalk.bold('checks'));
  lines.push(
    ...result.checks.map((check) => {
      const status =
        check.status === 'ok'
          ? chalk.green('ok')
          : check.status === 'warn'
            ? chalk.yellow('warn')
            : chalk.blue('info');

      return `  ${status} ${check.label.padEnd(6, ' ')} ${check.message}`;
    })
  );

  return lines.join('\n');
}

function formatDetail(label: string, value: string): string {
  return `  ${chalk.cyan(label.padEnd(5, ' '))} ${value}`;
}

function formatPath(input: string): string {
  const home = os.homedir();

  if (input === home) {
    return '~';
  }

  if (input.startsWith(`${home}/`)) {
    return input.replace(home, '~');
  }

  return input;
}

function formatDiagnosedValue(input: {
  value?: string;
  source: 'local' | 'global' | 'unset';
}): string {
  if (!input.value) {
    return chalk.dim(`not set (${input.source})`);
  }

  return `${input.value} ${chalk.dim(`(${input.source})`)}`;
}
