/*
 * Covers repository policy loading, validation, and evaluation behavior.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  InvalidRepoPolicyError,
  RepoPolicyNotFoundError,
  evaluateRepoPolicy,
  loadOptionalRepoPolicy,
  loadRepoPolicy
} from '../src/application/repo-policy.js';

function createRepositoryStub(repoDir?: string) {
  return {
    async isInsideWorkTree() {
      return Boolean(repoDir);
    },
    async getTopLevelPath() {
      return repoDir;
    }
  };
}

test('loadRepoPolicy reads a valid v1 repo policy file', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-policy-'));

  await mkdir(tempDir, { recursive: true });
  await writeFile(
    path.join(tempDir, '.gitrole'),
    JSON.stringify(
      {
        version: 1,
        defaultRole: 'synsoftworksdev',
        allowedRoles: ['synsoftworksdev', 'saraeloop']
      },
      null,
      2
    ),
    'utf8'
  );

  const repoPolicy = await loadRepoPolicy(createRepositoryStub(tempDir));

  assert.deepEqual(repoPolicy, {
    version: 1,
    defaultRole: 'synsoftworksdev',
    allowedRoles: ['synsoftworksdev', 'saraeloop']
  });
});

test('loadOptionalRepoPolicy returns undefined when .gitrole is absent', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-policy-missing-'));
  const repoPolicy = await loadOptionalRepoPolicy(createRepositoryStub(tempDir));

  assert.equal(repoPolicy, undefined);
});

test('loadRepoPolicy fails on invalid JSON', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-policy-json-'));

  await writeFile(path.join(tempDir, '.gitrole'), '{not-json', 'utf8');

  await assert.rejects(
    () => loadRepoPolicy(createRepositoryStub(tempDir)),
    InvalidRepoPolicyError
  );
});

test('loadRepoPolicy fails when defaultRole is not in allowedRoles', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-policy-schema-'));

  await writeFile(
    path.join(tempDir, '.gitrole'),
    JSON.stringify(
      {
        version: 1,
        defaultRole: 'synsoftworksdev',
        allowedRoles: ['saraeloop']
      },
      null,
      2
    ),
    'utf8'
  );

  await assert.rejects(
    () => loadRepoPolicy(createRepositoryStub(tempDir)),
    InvalidRepoPolicyError
  );
});

test('loadRepoPolicy fails when .gitrole is missing', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gitrole-policy-no-file-'));

  await assert.rejects(
    () => loadRepoPolicy(createRepositoryStub(tempDir)),
    RepoPolicyNotFoundError
  );
});

test('evaluateRepoPolicy distinguishes default, allowed, and notAllowed roles', () => {
  const repoPolicy = {
    version: 1 as const,
    defaultRole: 'synsoftworksdev',
    allowedRoles: ['synsoftworksdev', 'saraeloop']
  };

  assert.equal(evaluateRepoPolicy(repoPolicy, 'synsoftworksdev').status, 'default');
  assert.equal(evaluateRepoPolicy(repoPolicy, 'saraeloop').status, 'allowed');
  assert.equal(evaluateRepoPolicy(repoPolicy, 'client-acme').status, 'notAllowed');
});
