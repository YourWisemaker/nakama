import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";

export function useSkillProposals(
  orgId: string | null,
  options: {
    status?: "pending" | "approved" | "rejected";
    profileId?: string;
    refetchInterval?: number;
  } = {},
) {
  const status = options.status ?? "pending";
  return useQuery({
    queryKey: queryKeys.skillProposals(orgId ?? "", status, options.profileId),
    queryFn: () =>
      client.listSkillProposals(orgId ?? "", {
        status,
        profileId: options.profileId,
      }),
    enabled: Boolean(orgId),
    refetchInterval: options.refetchInterval,
  });
}

function invalidateSkillProposalQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  orgId: string,
) {
  return queryClient.invalidateQueries({ queryKey: ["skillProposals", orgId] });
}

export function useApproveSkillProposal(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => client.approveSkillProposal(orgId, proposalId),
    onSuccess: () => invalidateSkillProposalQueries(queryClient, orgId),
  });
}

export function useRejectSkillProposal(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => client.rejectSkillProposal(orgId, proposalId),
    onSuccess: () => invalidateSkillProposalQueries(queryClient, orgId),
  });
}
