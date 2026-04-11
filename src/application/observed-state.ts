import type {
  DiagnosedValue,
  DoctorDependencies,
  DoctorResult,
  IdentityScopeResult,
  SshAuthProbeResult
} from './contracts.js';

export interface ObservedState {
  commitIdentity: DoctorResult['commitIdentity'];
  configuredIdentity: DoctorResult['configuredIdentity'];
  scope: IdentityScopeResult;
  repository: DoctorResult['repository'];
  sshAuth?: SshAuthProbeResult;
}

export async function collectObservedState(
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
    remote
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
    dependencies.repository.getOriginRemote()
  ]);

  const sshAuth =
    remote?.protocol === 'ssh' && remote.host
      ? await dependencies.sshAuthProbe.probeGithubUser(remote.host)
      : undefined;
  const commitIdentity = {
    fullName: diagnoseValue(localName, globalName),
    email: diagnoseValue(localEmail, globalEmail)
  };

  return {
    commitIdentity,
    configuredIdentity: {
      local: {
        fullName: localName,
        email: localEmail
      },
      global: {
        fullName: globalName,
        email: globalEmail
      }
    },
    scope: detectIdentityScope(commitIdentity),
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

function detectIdentityScope(identity: DoctorResult['commitIdentity']): IdentityScopeResult {
  const sources = [identity.fullName.source, identity.email.source];

  if (sources.every((source) => source === 'unset')) {
    return {
      effective: 'unset',
      hasLocalOverride: false
    };
  }

  const hasLocalOverride = sources.includes('local');

  if (sources.every((source) => source === 'local')) {
    return {
      effective: 'local',
      hasLocalOverride
    };
  }

  if (sources.every((source) => source === 'global')) {
    return {
      effective: 'global',
      hasLocalOverride
    };
  }

  return {
    effective: 'mixed',
    hasLocalOverride
  };
}
