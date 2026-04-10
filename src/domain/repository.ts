export type RemoteProtocol = 'ssh' | 'https' | 'unknown';

export interface RemoteInfo {
  name: string;
  url: string;
  protocol: RemoteProtocol;
  host?: string;
  owner?: string;
  repository?: string;
}

/**
 * Parses a Git remote URL into a structured representation suitable for
 * repository diagnostics.
 */
export function parseRemoteUrl(name: string, url: string): RemoteInfo {
  const httpsMatch = /^https:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i.exec(url);

  if (httpsMatch) {
    return {
      name,
      url,
      protocol: 'https',
      host: httpsMatch[1],
      owner: httpsMatch[2],
      repository: httpsMatch[3]
    };
  }

  const sshScpMatch = /^(?:[^@]+@)?([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i.exec(url);

  if (sshScpMatch) {
    return {
      name,
      url,
      protocol: 'ssh',
      host: sshScpMatch[1],
      owner: sshScpMatch[2],
      repository: sshScpMatch[3]
    };
  }

  const sshUrlMatch = /^ssh:\/\/(?:[^@]+@)?([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i.exec(url);

  if (sshUrlMatch) {
    return {
      name,
      url,
      protocol: 'ssh',
      host: sshUrlMatch[1],
      owner: sshUrlMatch[2],
      repository: sshUrlMatch[3]
    };
  }

  return {
    name,
    url,
    protocol: 'unknown'
  };
}
