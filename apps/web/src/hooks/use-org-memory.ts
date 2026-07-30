import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddOrgMemoryFactRequest,
  ArchiveOrgMemoryRequest,
  PinOrgMemoryRequest,
  UnpinOrgMemoryRequest,
  UpdateOrgMemoryRequest,
} from "@nakama/core/contract";
import { client } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";

export function useOrgMemory(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.orgMemory(orgId ?? ""),
    queryFn: () => client.getOrgMemory(orgId ?? ""),
    enabled: Boolean(orgId),
  });
}

function invalidateOrgMemory(
  queryClient: ReturnType<typeof useQueryClient>,
  orgId: string,
) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.orgMemory(orgId) });
}

export function useUpdateOrgMemory(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateOrgMemoryRequest) => client.updateOrgMemory(orgId, request),
    onSuccess: () => invalidateOrgMemory(queryClient, orgId),
  });
}

function useAddOrgMemoryFact(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AddOrgMemoryFactRequest) => client.addOrgMemoryFact(orgId, request),
    onSuccess: () => invalidateOrgMemory(queryClient, orgId),
  });
}

function usePinOrgMemoryFact(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: PinOrgMemoryRequest) => client.pinOrgMemoryFact(orgId, request),
    onSuccess: () => invalidateOrgMemory(queryClient, orgId),
  });
}

function useUnpinOrgMemoryFact(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UnpinOrgMemoryRequest) => client.unpinOrgMemoryFact(orgId, request),
    onSuccess: () => invalidateOrgMemory(queryClient, orgId),
  });
}

function useArchiveOrgMemory(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ArchiveOrgMemoryRequest) => client.archiveOrgMemory(orgId, request),
    onSuccess: () => invalidateOrgMemory(queryClient, orgId),
  });
}
