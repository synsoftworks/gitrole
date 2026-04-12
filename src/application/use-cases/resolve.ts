/*
 * Resolves the default role declared by the current repository's policy file.
 */
import type { RepoPolicy, ResolveRepoPolicyDependencies } from '../contracts.js';
import { loadRepoPolicy } from '../repo-policy.js';

/**
 * Resolves the repository-local default role from the repo policy file.
 *
 * @remarks
 * This is a small machine/human primitive: it answers "what role belongs here?"
 * without adding any switching or enforcement behavior.
 */
export async function resolveRepoPolicy(
  dependencies: ResolveRepoPolicyDependencies
): Promise<RepoPolicy> {
  return loadRepoPolicy(dependencies.repository);
}
