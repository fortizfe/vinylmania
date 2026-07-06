import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import * as discogsOauthApi from '../services/discogsOauthApi';
import type { DiscogsConnectionStatus } from '../services/discogsOauthApi';

export const discogsOauthKeys = {
  all: ['discogs-oauth'] as const,
  status: () => [...discogsOauthKeys.all, 'status'] as const,
};

export function useDiscogsStatus(): UseQueryResult<DiscogsConnectionStatus> {
  return useQuery({
    queryKey: discogsOauthKeys.status(),
    queryFn: discogsOauthApi.getDiscogsStatus,
  });
}

export function useRequestDiscogsLink(): UseMutationResult<{ authorizeUrl: string }, unknown, void> {
  return useMutation({
    mutationFn: discogsOauthApi.requestDiscogsLink,
    onSuccess: ({ authorizeUrl }) => {
      window.location.assign(authorizeUrl);
    },
  });
}

export interface CompleteDiscogsLinkArgs {
  oauthToken: string;
  oauthVerifier: string;
}

export function useCompleteDiscogsLink(): UseMutationResult<
  DiscogsConnectionStatus,
  unknown,
  CompleteDiscogsLinkArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ oauthToken, oauthVerifier }: CompleteDiscogsLinkArgs) =>
      discogsOauthApi.completeDiscogsLink(oauthToken, oauthVerifier),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: discogsOauthKeys.all });
    },
  });
}

export function useDisconnectDiscogs(): UseMutationResult<void, unknown, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: discogsOauthApi.disconnectDiscogs,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: discogsOauthKeys.all });
    },
  });
}
