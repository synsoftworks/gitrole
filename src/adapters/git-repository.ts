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

export interface GitRepositoryOptions {
  binaryPath?: string;
  exec?: ExecFile;
}

export class SystemGitRepository {
  private readonly binaryPath: string;
  private readonly exec: ExecFile;

  constructor(options: GitRepositoryOptions = {}) {
    this.binaryPath = options.binaryPath ?? process.env.GITROLE_GIT_BIN ?? 'git';
    this.exec = options.exec ?? execFile;
  }

  async isInsideWorkTree(): Promise<boolean> {
    try {
      const result = await this.run(['rev-parse', '--is-inside-work-tree']);
      return result.stdout.trim() === 'true';
    } catch (error) {
      if (error instanceof GitNotInstalledError) {
        throw error;
      }

      return false;
    }
  }

  async hasCommits(): Promise<boolean> {
    try {
      await this.run(['rev-parse', '--verify', 'HEAD']);
      return true;
    } catch (error) {
      if (error instanceof GitNotInstalledError) {
        throw error;
      }

      return false;
    }
  }

  async getTopLevelPath(): Promise<string | undefined> {
    return this.getOptionalValue(['rev-parse', '--show-toplevel']);
  }

  async getCurrentBranch(): Promise<string | undefined> {
    return this.getOptionalValue(['branch', '--show-current']);
  }

  async getUpstreamBranch(): Promise<string | undefined> {
    return this.getOptionalValue(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  }

  async getOriginUrl(): Promise<string | undefined> {
    return this.getOptionalValue(['remote', 'get-url', 'origin']);
  }

  async setOriginUrl(url: string): Promise<void> {
    await this.run(['remote', 'set-url', 'origin', url]);
  }

  async getLocalUserName(): Promise<string | undefined> {
    return this.getOptionalValue(['config', '--local', '--get', 'user.name']);
  }

  async getLocalUserEmail(): Promise<string | undefined> {
    return this.getOptionalValue(['config', '--local', '--get', 'user.email']);
  }

  async setLocalUserName(name: string): Promise<void> {
    await this.run(['config', '--local', 'user.name', name]);
  }

  async setLocalUserEmail(email: string): Promise<void> {
    await this.run(['config', '--local', 'user.email', email]);
  }

  private async getOptionalValue(args: string[]): Promise<string | undefined> {
    try {
      const result = await this.run(args);
      const value = result.stdout.trim();

      return value ? value : undefined;
    } catch (error) {
      if (error instanceof GitNotInstalledError) {
        throw error;
      }

      return undefined;
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
  if (error.code === 'ENOENT') {
    return new GitNotInstalledError();
  }

  return new Error(error.message);
}
