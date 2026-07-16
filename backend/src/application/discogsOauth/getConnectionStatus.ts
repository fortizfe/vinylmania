import type { ConnectionStatus } from '../../domain/discogsOauth/types';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';

export function createGetConnectionStatusUseCase(deps: {
  discogsConnection: DiscogsConnectionPort;
}) {
  return async function getConnectionStatus(uid: string): Promise<ConnectionStatus> {
    const connection = await deps.discogsConnection.getConnection(uid);
    if (!connection) {
      return { connected: false };
    }
    return {
      connected: true,
      discogsUsername: connection.discogsUsername,
      linkedAt: connection.linkedAt,
    };
  };
}
