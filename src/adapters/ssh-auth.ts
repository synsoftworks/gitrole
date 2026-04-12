/*
 * Probes SSH authentication output to identify the GitHub account behind a host alias.
 */
import { execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(nodeExecFile);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export type ExecFile = (file: string, args: string[]) => Promise<ExecResult>;

export interface SshAuthProbeOptions {
  binaryPath?: string;
  exec?: ExecFile;
}

export interface SshAuthProbeResult {
  ok: boolean;
  host: string;
  githubUser?: string;
  message?: string;
}

export class SystemSshAuthProbe {
  private readonly binaryPath: string;
  private readonly exec: ExecFile;

  constructor(options: SshAuthProbeOptions = {}) {
    this.binaryPath = options.binaryPath ?? process.env.GITROLE_SSH_BIN ?? 'ssh';
    this.exec = options.exec ?? execFile;
  }

  async probeGithubUser(host: string): Promise<SshAuthProbeResult> {
    try {
      const result = await this.exec(this.binaryPath, [
        '-T',
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=5',
        `git@${host}`
      ]);

      return mapProbeOutput(host, `${result.stdout}\n${result.stderr}`);
    } catch (error) {
      const execError = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
      };

      if (execError.code === 'ENOENT') {
        return {
          ok: false,
          host,
          message: 'ssh is not installed or not available on PATH'
        };
      }

      const output = `${execError.stdout ?? ''}\n${execError.stderr ?? ''}`;
      const parsed = mapProbeOutput(host, output);

      if (parsed.githubUser) {
        return parsed;
      }

      return {
        ok: false,
        host,
        message: normalizeMessage(execError.message || output)
      };
    }
  }
}

export function mapProbeOutput(host: string, output: string): SshAuthProbeResult {
  const match = /Hi ([A-Za-z0-9-]+)! You've successfully authenticated/i.exec(output);

  if (match) {
    return {
      ok: true,
      host,
      githubUser: match[1]
    };
  }

  const message = normalizeMessage(output);

  return {
    ok: false,
    host,
    message
  };
}

function normalizeMessage(message: string): string {
  return message.trim() || 'unable to determine SSH auth identity';
}
