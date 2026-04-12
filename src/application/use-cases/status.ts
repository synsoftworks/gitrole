/*
 * Produces the compact status summary shown by the CLI.
 */
import type {
  DoctorDependencies,
  DoctorResult,
  NonMergeCommit,
  StatusResult
} from '../contracts.js';
import { doctor } from './diagnosis.js';

/**
 * Returns a compact alignment summary for the current environment.
 */
export async function getStatus(
  dependencies: DoctorDependencies
): Promise<StatusResult> {
  const verification = await collectVerificationContext(dependencies);
  const { doctorResult, lastNonMergeCommit } = verification;
  const commitIdentity = formatCommitIdentity(doctorResult.commitIdentity);

  return {
    roleName: doctorResult.role?.name ?? 'no-role',
    commitIdentity,
    scope: doctorResult.scope.effective,
    localOverride: doctorResult.scope.hasLocalOverride,
    lastNonMergeCommit,
    overall: getStatusOverall(doctorResult, lastNonMergeCommit),
    commit: getCheckGroupStatus(doctorResult.checks, ['role', 'commit', 'identity', 'fix', 'scope']),
    remote: getRemoteStatus(doctorResult),
    auth: getAuthStatus(doctorResult),
    repoPolicy: doctorResult.repoPolicy
  };
}

async function collectVerificationContext(
  dependencies: DoctorDependencies
): Promise<{
  doctorResult: DoctorResult;
  lastNonMergeCommit?: NonMergeCommit;
}> {
  const doctorResult = await doctor(dependencies);
  const lastNonMergeCommit = await dependencies.repository.getLatestNonMergeCommit();

  return {
    doctorResult,
    lastNonMergeCommit
  };
}

function formatCommitIdentity(identity: DoctorResult['commitIdentity']): string | undefined {
  if (!identity.fullName.value || !identity.email.value) {
    return undefined;
  }

  return `${identity.fullName.value} <${identity.email.value}>`;
}

function getCheckGroupStatus(
  checks: DoctorResult['checks'],
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

function getStatusOverall(
  doctorResult: DoctorResult,
  lastNonMergeCommit?: NonMergeCommit
): 'aligned' | 'warning' {
  if (doctorResult.overall === 'warning') {
    return 'warning';
  }

  if (isLastNonMergeCommitMismatch(doctorResult, lastNonMergeCommit)) {
    return 'warning';
  }

  return 'aligned';
}

function isLastNonMergeCommitMismatch(
  doctorResult: DoctorResult,
  lastNonMergeCommit?: NonMergeCommit
): boolean {
  const effectiveIdentity = formatCommitIdentity(doctorResult.commitIdentity);

  if (!effectiveIdentity || !lastNonMergeCommit) {
    return false;
  }

  return (
    doctorResult.commitIdentity.fullName.value !== lastNonMergeCommit.authorName ||
    doctorResult.commitIdentity.email.value !== lastNonMergeCommit.authorEmail
  );
}
