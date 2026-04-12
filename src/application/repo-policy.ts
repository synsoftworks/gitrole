/*
 * Loads and evaluates the repository-local .gitrole policy file.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  GitRepository,
  RepoPolicy,
  RepoPolicyEvaluation,
  RepoPolicyStatus
} from './contracts.js';

export const repoPolicyFilename = '.gitrole';

export class RepoPolicyRepositoryContextError extends Error {
  constructor() {
    super('not inside a git repository; resolve requires a repo context');
    this.name = 'RepoPolicyRepositoryContextError';
  }
}

export class RepoPolicyNotFoundError extends Error {
  constructor() {
    super(`repo policy file ${repoPolicyFilename} was not found in the repository root`);
    this.name = 'RepoPolicyNotFoundError';
  }
}

export class InvalidRepoPolicyError extends Error {
  constructor(reason: string) {
    super(`repo policy file ${repoPolicyFilename} is invalid: ${reason}`);
    this.name = 'InvalidRepoPolicyError';
  }
}

export async function resolveRepoPolicyPath(
  repository: Pick<GitRepository, 'isInsideWorkTree' | 'getTopLevelPath'>
): Promise<string> {
  if (!(await repository.isInsideWorkTree())) {
    throw new RepoPolicyRepositoryContextError();
  }

  const topLevelPath = await repository.getTopLevelPath();

  if (!topLevelPath) {
    throw new RepoPolicyRepositoryContextError();
  }

  return path.join(topLevelPath, repoPolicyFilename);
}

export async function loadRepoPolicy(
  repository: Pick<GitRepository, 'isInsideWorkTree' | 'getTopLevelPath'>
): Promise<RepoPolicy> {
  const targetPath = await resolveRepoPolicyPath(repository);
  return loadRepoPolicyFile(targetPath);
}

export async function loadOptionalRepoPolicy(
  repository: Pick<GitRepository, 'isInsideWorkTree' | 'getTopLevelPath'>
): Promise<RepoPolicy | undefined> {
  if (!(await repository.isInsideWorkTree())) {
    return undefined;
  }

  const topLevelPath = await repository.getTopLevelPath();

  if (!topLevelPath) {
    return undefined;
  }

  try {
    return await loadRepoPolicyFile(path.join(topLevelPath, repoPolicyFilename));
  } catch (error) {
    if (error instanceof RepoPolicyNotFoundError) {
      return undefined;
    }

    throw error;
  }
}

export function evaluateRepoPolicy(
  repoPolicy: RepoPolicy,
  effectiveRole?: string
): RepoPolicyEvaluation {
  let status: RepoPolicyStatus;

  if (effectiveRole === repoPolicy.defaultRole) {
    status = 'default';
  } else if (effectiveRole && repoPolicy.allowedRoles.includes(effectiveRole)) {
    status = 'allowed';
  } else {
    status = 'notAllowed';
  }

  return {
    ...repoPolicy,
    effectiveRole,
    status
  };
}

async function loadRepoPolicyFile(targetPath: string): Promise<RepoPolicy> {
  let source: string;

  try {
    source = await readFile(targetPath, 'utf8');
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;

    if (readError.code === 'ENOENT') {
      throw new RepoPolicyNotFoundError();
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch {
    throw new InvalidRepoPolicyError('expected valid JSON');
  }

  return validateRepoPolicy(parsed);
}

function validateRepoPolicy(input: unknown): RepoPolicy {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidRepoPolicyError('expected a JSON object');
  }

  const version = Reflect.get(input, 'version');
  const defaultRole = normalizeNonEmptyString(Reflect.get(input, 'defaultRole'));
  const allowedRoles = normalizeAllowedRoles(Reflect.get(input, 'allowedRoles'));

  if (version !== 1) {
    throw new InvalidRepoPolicyError('version must be exactly 1');
  }

  if (!defaultRole) {
    throw new InvalidRepoPolicyError('defaultRole must be a non-empty string');
  }

  if (allowedRoles.length === 0) {
    throw new InvalidRepoPolicyError('allowedRoles must be a non-empty array of non-empty strings');
  }

  if (!allowedRoles.includes(defaultRole)) {
    throw new InvalidRepoPolicyError('defaultRole must appear in allowedRoles');
  }

  return {
    version: 1,
    defaultRole,
    allowedRoles
  };
}

function normalizeAllowedRoles(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const values = input
    .map((value) => normalizeNonEmptyString(value))
    .filter((value): value is string => Boolean(value));

  return values;
}

function normalizeNonEmptyString(input: unknown): string | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }

  const value = input.trim();
  return value ? value : undefined;
}
