import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { normalizeRole, type Role } from '../domain/role.js';

interface StoredRoles {
  roles: Role[];
}

export interface RoleStoreOptions {
  configFilePath?: string;
  env?: NodeJS.ProcessEnv;
}

export class FileRoleStore {
  private readonly configFilePath: string;

  constructor(options: RoleStoreOptions = {}) {
    this.configFilePath =
      options.configFilePath ?? resolveRolesFilePath(options.env ?? process.env);
  }

  async list(): Promise<Role[]> {
    const data = await this.readData();

    return data.roles;
  }

  async get(name: string): Promise<Role | undefined> {
    const roles = await this.list();

    return roles.find((role) => role.name === name);
  }

  async save(role: Role): Promise<void> {
    const normalizedRole = normalizeRole(role);
    const data = await this.readData();
    const existingIndex = data.roles.findIndex(
      (candidate) => candidate.name === normalizedRole.name
    );

    if (existingIndex >= 0) {
      data.roles[existingIndex] = normalizedRole;
    } else {
      data.roles.push(normalizedRole);
    }

    await this.writeData(data);
  }

  async remove(name: string): Promise<boolean> {
    const data = await this.readData();
    const nextRoles = data.roles.filter((role) => role.name !== name);
    const changed = nextRoles.length !== data.roles.length;

    if (!changed) {
      return false;
    }

    await this.writeData({ roles: nextRoles });

    return true;
  }

  private async readData(): Promise<StoredRoles> {
    await this.ensureFile();

    const raw = await readFile(this.configFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredRoles>;
    const roles = Array.isArray(parsed.roles) ? parsed.roles.map(normalizeRole) : [];

    return { roles };
  }

  private async writeData(data: StoredRoles): Promise<void> {
    const directory = path.dirname(this.configFilePath);
    const tempFilePath = path.join(
      directory,
      `.roles.json.tmp-${process.pid}-${Date.now()}`
    );

    await mkdir(directory, { recursive: true });
    await writeFile(tempFilePath, `${JSON.stringify({ roles: data.roles }, null, 2)}\n`, 'utf8');
    await rename(tempFilePath, this.configFilePath);
  }

  private async ensureFile(): Promise<void> {
    await mkdir(path.dirname(this.configFilePath), { recursive: true });

    try {
      await readFile(this.configFilePath, 'utf8');
    } catch (error) {
      const readError = error as NodeJS.ErrnoException;

      if (readError.code !== 'ENOENT') {
        throw error;
      }

      await this.writeData({ roles: [] });
    }
  }
}

export function resolveRolesFilePath(env: NodeJS.ProcessEnv = process.env): string {
  const configHome =
    env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), '.config');

  return path.join(configHome, 'gitrole', 'roles.json');
}
