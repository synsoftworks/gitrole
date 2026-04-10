import { matchesIdentity, normalizeRole, type GitIdentity, type Role } from '../domain/role.js';
import { parseRemoteUrl, type RemoteInfo } from '../domain/repository.js';

export class ProfileNotFoundError extends Error {
  constructor(name: string) {
    super(`role "${name}" was not found`);
    this.name = 'ProfileNotFoundError';
  }
}

export class GitNotInstalledError extends Error {
  constructor() {
    super('git is not installed or not available on PATH');
    this.name = 'GitNotInstalledError';
  }
}

export interface RoleStore {
  list(): Promise<Role[]>;
  get(name: string): Promise<Role | undefined>;
  save(role: Role): Promise<void>;
  remove(name: string): Promise<boolean>;
}

export interface GitConfig {
  getGlobalUserName(): Promise<string | undefined>;
  getGlobalUserEmail(): Promise<string | undefined>;
  setGlobalUserName(name: string): Promise<void>;
  setGlobalUserEmail(email: string): Promise<void>;
}

export interface SshLoadResult {
  ok: boolean;
  message?: string;
}

export interface SshAgent {
  loadKey(path: string): Promise<SshLoadResult>;
}

export interface AppDependencies {
  roleStore: RoleStore;
  gitConfig: GitConfig;
  sshAgent: SshAgent;
}

export interface GitRepository {
  isInsideWorkTree(): Promise<boolean>;
  hasCommits(): Promise<boolean>;
  getTopLevelPath(): Promise<string | undefined>;
  getCurrentBranch(): Promise<string | undefined>;
  getUpstreamBranch(): Promise<string | undefined>;
  getOriginUrl(): Promise<string | undefined>;
  setOriginUrl(url: string): Promise<void>;
  getLocalUserName(): Promise<string | undefined>;
  getLocalUserEmail(): Promise<string | undefined>;
}

export interface SshAuthProbeResult {
  ok: boolean;
  host: string;
  githubUser?: string;
  message?: string;
}

export interface SshAuthProbe {
  probeGithubUser(host: string): Promise<SshAuthProbeResult>;
}

export interface DoctorDependencies {
  roleStore: RoleStore;
  gitConfig: GitConfig;
  repository: GitRepository;
  sshAuthProbe: SshAuthProbe;
}

export interface UseRoleDependencies extends AppDependencies {
  repository?: GitRepository;
  sshAuthProbe?: SshAuthProbe;
}

export interface RemoteUseDependencies {
  roleStore: RoleStore;
  repository: GitRepository;
}

export interface UseRoleResult {
  role: Role;
  ssh?: SshLoadResult & { path: string };
  alignment?: RoleAlignmentResult;
}

export interface CurrentRoleResult {
  identity: GitIdentity;
  role?: Role;
}

export interface ListRolesResult {
  roles: Role[];
  activeRoleName?: string;
}

export interface DiagnosedValue {
  value?: string;
  source: 'local' | 'global' | 'unset';
}

export interface DoctorCheck {
  status: 'ok' | 'warn' | 'info';
  label: string;
  message: string;
}

export interface DoctorResult {
  role?: Role;
  commitIdentity: {
    fullName: DiagnosedValue;
    email: DiagnosedValue;
  };
  repository: {
    isInsideWorkTree: boolean;
    hasCommits?: boolean;
    topLevelPath?: string;
    currentBranch?: string;
    upstreamBranch?: string;
    remote?: RemoteInfo;
  };
  sshAuth?: SshAuthProbeResult;
  checks: DoctorCheck[];
}

export interface RoleAlignmentResult {
  role: Role;
  repository: DoctorResult['repository'];
  commitIdentity: DoctorResult['commitIdentity'];
  sshAuth?: SshAuthProbeResult;
  checks: DoctorCheck[];
}

export interface RemoteUseResult {
  role: Role;
  previousUrl: string;
  nextUrl: string;
}

export interface StatusResult {
  roleName: string;
  commitIdentity?: string;
  overall: 'aligned' | 'warning';
  commit: 'ok' | 'warn' | 'na';
  remote: 'ok' | 'warn' | 'na';
  auth: 'ok' | 'warn' | 'na';
}

export class RoleMissingGithubHostError extends Error {
  constructor(name: string) {
    super(`role "${name}" does not define githubHost`);
    this.name = 'RoleMissingGithubHostError';
  }
}

export class OriginRemoteNotConfiguredError extends Error {
  constructor() {
    super('origin remote is not configured');
    this.name = 'OriginRemoteNotConfiguredError';
  }
}

export class UnsupportedRemoteRewriteError extends Error {
  constructor() {
    super('origin remote could not be rewritten because its owner/repository could not be determined');
    this.name = 'UnsupportedRemoteRewriteError';
  }
}

/**
 * Creates or updates a saved role definition.
 *
 * The role is normalized before storage so whitespace does not produce duplicate
 * or surprising values in the persisted config.
 */
export async function addRole(
  dependencies: AppDependencies,
  input: Role
): Promise<Role> {
  const role = normalizeRole(input);

  await dependencies.roleStore.save(role);

  return role;
}

/**
 * Applies the selected role to global Git config and optionally loads its SSH key.
 *
 * Git identity changes are the primary operation. SSH key loading is a best-effort
 * follow-up and does not block a successful switch when `ssh-add` fails.
 *
 * @throws {ProfileNotFoundError} When the named role does not exist.
 */
export async function useRole(
  dependencies: UseRoleDependencies,
  name: string
): Promise<UseRoleResult> {
  const role = await dependencies.roleStore.get(name);

  if (!role) {
    throw new ProfileNotFoundError(name);
  }

  await dependencies.gitConfig.setGlobalUserName(role.fullName);
  await dependencies.gitConfig.setGlobalUserEmail(role.email);

  if (!role.sshKeyPath) {
    return {
      role,
      alignment: await maybeAssessRoleAlignment(dependencies, role)
    };
  }

  const ssh = await dependencies.sshAgent.loadKey(role.sshKeyPath);

  return {
    role,
    ssh: {
      ...ssh,
      path: role.sshKeyPath
    },
    alignment: await maybeAssessRoleAlignment(dependencies, role)
  };
}

/**
 * Reads the current global Git identity and resolves it to a saved role when
 * both name and email match exactly.
 */
export async function getCurrentRole(
  dependencies: AppDependencies
): Promise<CurrentRoleResult> {
  const [roles, fullName, email] = await Promise.all([
    dependencies.roleStore.list(),
    dependencies.gitConfig.getGlobalUserName(),
    dependencies.gitConfig.getGlobalUserEmail()
  ]);

  const identity = { fullName, email };
  const role = roles.find((candidate) => matchesIdentity(candidate, identity));

  return { identity, role };
}

/**
 * Lists all saved roles and marks which one is currently active, if any.
 */
export async function listRoles(
  dependencies: AppDependencies
): Promise<ListRolesResult> {
  const [roles, current] = await Promise.all([
    dependencies.roleStore.list(),
    getCurrentRole(dependencies)
  ]);

  return {
    roles,
    activeRoleName: current.role?.name
  };
}

/**
 * Deletes a saved role definition without changing the active Git config.
 *
 * @throws {ProfileNotFoundError} When the named role does not exist.
 */
export async function removeRole(
  dependencies: AppDependencies,
  name: string
): Promise<Role> {
  const role = await dependencies.roleStore.get(name);

  if (!role) {
    throw new ProfileNotFoundError(name);
  }

  await dependencies.roleStore.remove(name);

  return role;
}

/**
 * Diagnoses the active commit identity and push path for the current repository.
 *
 * This use case answers two practical questions:
 * 1. Who will this commit say it is from?
 * 2. Who will GitHub think I am when I push over SSH?
 */
export async function doctor(
  dependencies: DoctorDependencies
): Promise<DoctorResult> {
  const [roles, observedState] = await Promise.all([
    dependencies.roleStore.list(),
    collectObservedState(dependencies)
  ]);
  const role = roles.find((candidate) =>
    matchesIdentity(candidate, {
      fullName: observedState.commitIdentity.fullName.value,
      email: observedState.commitIdentity.email.value
    })
  );
  const checks = buildDoctorChecks({
    role,
    roles,
    observedState
  });

  return {
    role,
    commitIdentity: observedState.commitIdentity,
    repository: observedState.repository,
    sshAuth: observedState.sshAuth,
    checks
  };
}

/**
 * Rewrites the `origin` remote to use the selected role's SSH host alias while
 * preserving the observed repository owner and name.
 *
 * @throws {ProfileNotFoundError} When the named role does not exist.
 * @throws {RoleMissingGithubHostError} When the role does not define a GitHub host alias.
 * @throws {OriginRemoteNotConfiguredError} When the repository has no `origin`.
 * @throws {UnsupportedRemoteRewriteError} When the current remote cannot be parsed.
 */
export async function useRemoteForRole(
  dependencies: RemoteUseDependencies,
  name: string
): Promise<RemoteUseResult> {
  const role = await dependencies.roleStore.get(name);

  if (!role) {
    throw new ProfileNotFoundError(name);
  }

  if (!role.githubHost) {
    throw new RoleMissingGithubHostError(name);
  }

  const previousUrl = await dependencies.repository.getOriginUrl();

  if (!previousUrl) {
    throw new OriginRemoteNotConfiguredError();
  }

  const remote = parseRemoteUrl('origin', previousUrl);

  if (!remote.owner || !remote.repository) {
    throw new UnsupportedRemoteRewriteError();
  }

  const nextUrl = `git@${role.githubHost}:${remote.owner}/${remote.repository}.git`;

  await dependencies.repository.setOriginUrl(nextUrl);

  return {
    role,
    previousUrl,
    nextUrl
  };
}

/**
 * Returns a compact alignment summary for the current environment.
 */
export async function getStatus(
  dependencies: DoctorDependencies
): Promise<StatusResult> {
  const result = await doctor(dependencies);
  const commitIdentity = formatCommitIdentity(result.commitIdentity);

  return {
    roleName: result.role?.name ?? 'no-role',
    commitIdentity,
    overall: getDoctorExitCode(result) === 0 ? 'aligned' : 'warning',
    commit: getCheckGroupStatus(result.checks, ['role', 'commit', 'identity', 'fix']),
    remote: getRemoteStatus(result),
    auth: getAuthStatus(result)
  };
}

export function getDoctorExitCode(result: Pick<DoctorResult, 'checks'>): number {
  return result.checks.some((check) => check.status === 'warn') ? 2 : 0;
}

function diagnoseValue(localValue?: string, globalValue?: string): DiagnosedValue {
  if (localValue) {
    return {
      value: localValue,
      source: 'local'
    };
  }

  if (globalValue) {
    return {
      value: globalValue,
      source: 'global'
    };
  }

  return {
    source: 'unset'
  };
}

function buildDoctorChecks(input: {
  role?: Role;
  roles: Role[];
  observedState: ObservedState;
}): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const { observedState } = input;

  if (input.role) {
    checks.push({
      status: 'ok',
      label: 'role',
      message: `commit identity matches saved role ${input.role.name}`
    });
  } else {
    checks.push({
      status: 'warn',
      label: 'role',
      message: 'active commit identity does not match any saved role'
    });

    checks.push({
      status: 'info',
      label: 'fix',
      message:
        input.roles.length > 0
          ? 'add a role for the active commit identity or switch to the intended saved role before committing'
          : 'add a saved role for the active commit identity before committing'
    });
  }

  if (
    !observedState.commitIdentity.fullName.value ||
    !observedState.commitIdentity.email.value
  ) {
    checks.push({
      status: 'warn',
      label: 'commit',
      message: 'user.name or user.email is not fully configured'
    });
  }

  if (!observedState.repository.isInsideWorkTree) {
    checks.push({
      status: 'warn',
      label: 'repo',
      message: 'not inside a Git repository; remote push identity could not be diagnosed'
    });

    return checks;
  }

  if (observedState.repository.hasCommits === false) {
    checks.push({
      status: 'warn',
      label: 'history',
      message: 'repository has no commits yet; the first push will fail until HEAD exists'
    });
  }

  if (!observedState.repository.remote) {
    checks.push({
      status: 'warn',
      label: 'remote',
      message: 'origin remote is not configured'
    });

    return checks;
  }

  checks.push({
    status: 'info',
    label: 'remote',
    message: `origin uses ${observedState.repository.remote.protocol} at ${observedState.repository.remote.url}`
  });

  if (observedState.sshAuth?.ok && observedState.sshAuth.githubUser) {
    const commitIdentity = formatCommitIdentity(observedState.commitIdentity);
    const shouldReportIdentityDivergence =
      !input.role ||
      (input.role.githubUser !== undefined &&
        observedState.sshAuth.githubUser !== input.role.githubUser);

    if (commitIdentity && shouldReportIdentityDivergence) {
      checks.push({
        status: input.role ? 'warn' : 'warn',
        label: 'identity',
        message: `commit identity is ${commitIdentity} but SSH auth resolves to ${observedState.sshAuth.githubUser}`
      });
    }
  }

  if (!input.role) {
    return checks;
  }

  checks.push(
    ...buildRoleAlignmentChecks({
      role: input.role,
      observedState
    })
  );

  return checks;
}

function buildRoleAlignmentChecks(input: {
  role: Role;
  observedState: ObservedState;
}): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const { role, observedState } = input;

  if (
    observedState.commitIdentity.fullName.value !== role.fullName ||
    observedState.commitIdentity.email.value !== role.email
  ) {
    checks.push({
      status: 'warn',
      label: 'commit',
      message: `effective commit identity does not match selected role ${role.name}`
    });
  } else {
    checks.push({
      status: 'ok',
      label: 'commit',
      message: `effective commit identity matches selected role ${role.name}`
    });
  }

  if (!observedState.repository.isInsideWorkTree) {
    checks.push({
      status: 'warn',
      label: 'repo',
      message: 'not inside a Git repository; remote alignment could not be checked'
    });
    return dedupeChecks(checks);
  }

  if (!observedState.repository.remote) {
    checks.push({
      status: 'warn',
      label: 'remote',
      message: 'origin remote is not configured'
    });
    return dedupeChecks(checks);
  }

  if (role.githubHost && observedState.repository.remote?.host) {
    checks.push({
      status: role.githubHost === observedState.repository.remote.host ? 'ok' : 'warn',
      label: 'host',
      message:
        role.githubHost === observedState.repository.remote.host
          ? `remote host matches role githubHost ${role.githubHost}`
          : `remote host ${observedState.repository.remote.host} does not match role githubHost ${role.githubHost}`
    });
  }

  if (role.githubUser && observedState.repository.remote?.owner) {
    checks.push({
      status: role.githubUser === observedState.repository.remote.owner ? 'ok' : 'warn',
      label: 'owner',
      message:
        role.githubUser === observedState.repository.remote.owner
          ? `remote owner matches role githubUser ${role.githubUser}`
          : `remote owner ${observedState.repository.remote.owner} does not match role githubUser ${role.githubUser}`
    });
  }

  if (observedState.repository.remote?.protocol === 'https') {
    checks.push({
      status: 'warn',
      label: 'auth',
      message: 'origin uses HTTPS; gitrole cannot verify GitHub SSH auth identity for pushes'
    });
    return dedupeChecks(checks);
  }

  if (!observedState.sshAuth) {
    checks.push({
      status: 'warn',
      label: 'auth',
      message: 'SSH auth could not be probed for the current remote host'
    });
    return dedupeChecks(checks);
  }

  if (!observedState.sshAuth.ok) {
    checks.push({
      status: 'warn',
      label: 'auth',
      message: observedState.sshAuth.message ?? 'SSH auth identity could not be determined'
    });
    return dedupeChecks(checks);
  }

  if (role.githubUser) {
    checks.push({
      status: observedState.sshAuth.githubUser === role.githubUser ? 'ok' : 'warn',
      label: 'auth',
      message:
        observedState.sshAuth.githubUser === role.githubUser
          ? `SSH auth matches role githubUser ${role.githubUser}`
          : `SSH auth resolved to ${observedState.sshAuth.githubUser}, expected ${role.githubUser}`
    });
  } else if (observedState.sshAuth.githubUser) {
    checks.push({
      status: 'info',
      label: 'auth',
      message: `SSH auth resolved to ${observedState.sshAuth.githubUser}`
    });
  }

  return dedupeChecks(checks);
}

async function maybeAssessRoleAlignment(
  dependencies: UseRoleDependencies,
  role: Role
): Promise<RoleAlignmentResult | undefined> {
  if (!dependencies.repository || !dependencies.sshAuthProbe) {
    return undefined;
  }

  return assessRoleAlignment(
    {
      gitConfig: dependencies.gitConfig,
      repository: dependencies.repository,
      sshAuthProbe: dependencies.sshAuthProbe
    },
    role
  );
}

async function assessRoleAlignment(
  dependencies: Pick<DoctorDependencies, 'gitConfig' | 'repository' | 'sshAuthProbe'>,
  role: Role
): Promise<RoleAlignmentResult> {
  const observedState = await collectObservedState(dependencies);

  return {
    role,
    commitIdentity: observedState.commitIdentity,
    repository: observedState.repository,
    sshAuth: observedState.sshAuth,
    checks: buildRoleAlignmentChecks({ role, observedState })
  };
}

interface ObservedState {
  commitIdentity: DoctorResult['commitIdentity'];
  repository: DoctorResult['repository'];
  sshAuth?: SshAuthProbeResult;
}

async function collectObservedState(
  dependencies: Pick<DoctorDependencies, 'gitConfig' | 'repository' | 'sshAuthProbe'>
): Promise<ObservedState> {
  const [
    globalName,
    globalEmail,
    localName,
    localEmail,
    isInsideWorkTree,
    hasCommits,
    topLevelPath,
    currentBranch,
    upstreamBranch,
    originUrl
  ] = await Promise.all([
    dependencies.gitConfig.getGlobalUserName(),
    dependencies.gitConfig.getGlobalUserEmail(),
    dependencies.repository.getLocalUserName(),
    dependencies.repository.getLocalUserEmail(),
    dependencies.repository.isInsideWorkTree(),
    dependencies.repository.hasCommits(),
    dependencies.repository.getTopLevelPath(),
    dependencies.repository.getCurrentBranch(),
    dependencies.repository.getUpstreamBranch(),
    dependencies.repository.getOriginUrl()
  ]);

  const remote = originUrl ? parseRemoteUrl('origin', originUrl) : undefined;
  const sshAuth =
    remote?.protocol === 'ssh' && remote.host
      ? await dependencies.sshAuthProbe.probeGithubUser(remote.host)
      : undefined;

  return {
    commitIdentity: {
      fullName: diagnoseValue(localName, globalName),
      email: diagnoseValue(localEmail, globalEmail)
    },
    repository: {
      isInsideWorkTree,
      hasCommits: isInsideWorkTree ? hasCommits : undefined,
      topLevelPath,
      currentBranch,
      upstreamBranch,
      remote
    },
    sshAuth
  };
}

function dedupeChecks(checks: DoctorCheck[]): DoctorCheck[] {
  const seen = new Set<string>();

  return checks.filter((check) => {
    const key = `${check.status}:${check.label}:${check.message}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function formatCommitIdentity(identity: DoctorResult['commitIdentity']): string | undefined {
  if (!identity.fullName.value || !identity.email.value) {
    return undefined;
  }

  return `${identity.fullName.value} <${identity.email.value}>`;
}

function getCheckGroupStatus(
  checks: DoctorCheck[],
  labels: string[]
): 'ok' | 'warn' | 'na' {
  const relevantChecks = checks.filter((check) => labels.includes(check.label));

  if (relevantChecks.length === 0) {
    return 'na';
  }

  return relevantChecks.some((check) => check.status === 'warn') ? 'warn' : 'ok';
}

function getRemoteStatus(result: DoctorResult): 'ok' | 'warn' | 'na' {
  if (!result.repository.isInsideWorkTree) {
    return 'na';
  }

  if (!result.repository.remote) {
    return 'warn';
  }

  return getCheckGroupStatus(result.checks, ['repo', 'remote', 'host', 'owner', 'history']);
}

function getAuthStatus(result: DoctorResult): 'ok' | 'warn' | 'na' {
  if (!result.repository.isInsideWorkTree || !result.repository.remote) {
    return 'na';
  }

  if (result.repository.remote.protocol === 'https') {
    return 'warn';
  }

  if (!result.sshAuth || !result.sshAuth.ok) {
    return 'warn';
  }

  return result.checks.some((check) => check.label === 'auth' && check.status === 'warn')
    ? 'warn'
    : 'ok';
}
