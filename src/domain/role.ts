/*
 * Defines the role model and identity matching helpers used across gitrole.
 */
export interface Role {
  name: string;
  fullName: string;
  email: string;
  sshKeyPath?: string;
  githubUser?: string;
  githubHost?: string;
}

export interface GitIdentity {
  fullName?: string;
  email?: string;
}

/**
 * Normalizes persisted role input so comparisons and storage stay stable.
 *
 * Trims all string fields and removes empty optional values.
 */
export function normalizeRole(input: Role): Role {
  return {
    name: input.name.trim(),
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    sshKeyPath: input.sshKeyPath?.trim() || undefined,
    githubUser: input.githubUser?.trim() || undefined,
    githubHost: input.githubHost?.trim() || undefined
  };
}

/**
 * Returns true only when both the configured Git name and email match exactly.
 *
 * `gitrole current` relies on this strict rule to avoid ambiguous role detection.
 */
export function matchesIdentity(role: Role, identity: GitIdentity): boolean {
  return role.fullName === identity.fullName && role.email === identity.email;
}
