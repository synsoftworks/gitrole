import { execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';

import { GitNotInstalledError } from '../application/use-cases.js';

const execFile = promisify(nodeExecFile);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export type ExecFile = (file: string, args: string[]) => Promise<ExecResult>;
type ExecFailure = NodeJS.ErrnoException;

export interface GitConfigOptions {
  binaryPath?: string;
  exec?: ExecFile;
}

export class SystemGitConfig {
  private readonly binaryPath: string;
  private readonly exec: ExecFile;

  constructor(options: GitConfigOptions = {}) {
    this.binaryPath = options.binaryPath ?? process.env.GITROLE_GIT_BIN ?? 'git';
    this.exec = options.exec ?? execFile;
  }

  async getGlobalUserName(): Promise<string | undefined> {
    return this.getValue('user.name');
  }

  async getGlobalUserEmail(): Promise<string | undefined> {
    return this.getValue('user.email');
  }

  async setGlobalUserName(name: string): Promise<void> {
    await this.run(['config', '--global', 'user.name', name]);
  }

  async setGlobalUserEmail(email: string): Promise<void> {
    await this.run(['config', '--global', 'user.email', email]);
  }

  private async getValue(key: string): Promise<string | undefined> {
    try {
      const result = await this.run(['config', '--global', '--get', key]);
      const value = result.stdout.trim();

      return value ? value : undefined;
    } catch (error) {
      if (error instanceof GitNotInstalledError) {
        throw error;
      }

      const execError = error as ExecFailure;
      const errorCode = getErrorCode(execError);

      if (errorCode === 1) {
        return undefined;
      }

      throw mapGitError(execError);
    }
  }

  private async run(args: string[]): Promise<ExecResult> {
    try {
      return await this.exec(this.binaryPath, args);
    } catch (error) {
      throw mapGitError(error as ExecFailure);
    }
  }
}

function mapGitError(error: ExecFailure): Error {
  const errorCode = getErrorCode(error);

  if (errorCode === 'ENOENT') {
    return new GitNotInstalledError();
  }

  if (errorCode === 1) {
    return error;
  }

  return new Error(error.message);
}

function getErrorCode(error: ExecFailure): string | number | undefined {
  const errorCode = Reflect.get(error, 'code');

  if (typeof errorCode === 'string' || typeof errorCode === 'number') {
    return errorCode;
  }

  return undefined;
}
