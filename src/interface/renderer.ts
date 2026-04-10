import os from 'node:os';

import chalk from 'chalk';

import type {
  CurrentRoleResult,
  ListRolesResult,
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

      return `${marker} ${chalk.bold(role.name)} ${chalk.dim(
        `${role.fullName} <${role.email}>`
      )}${ssh}`;
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
