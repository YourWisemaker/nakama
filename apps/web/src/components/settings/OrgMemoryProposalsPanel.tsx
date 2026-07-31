import { useState } from "react";
import type { OrgMemoryProposal } from "@nakama/core/contract";
import { detectOrgMemoryInjectionWarnings } from "@nakama/core";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  useApproveOrgMemoryProposal,
  useOrgMemoryProposals,
  useRejectOrgMemoryProposal,
} from "@/hooks/use-org-memory-proposals";
import { formatError } from "@/lib/client";
import { toast } from "@/lib/toast";

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function ProposalRow({
  proposal,
  orgId,
}: {
  proposal: OrgMemoryProposal;
  orgId: string;
}) {
  const [pinOnApprove, setPinOnApprove] = useState(false);
  const approveMutation = useApproveOrgMemoryProposal(orgId);
  const rejectMutation = useRejectOrgMemoryProposal(orgId);
  const warnings = detectOrgMemoryInjectionWarnings(proposal.bullet);
  const busy = approveMutation.isPending || rejectMutation.isPending;

  async function handleApprove() {
    try {
      await approveMutation.mutateAsync({
        proposalId: proposal.id,
        request: { pin: pinOnApprove },
      });
      toast(pinOnApprove ? "Proposal approved and pinned." : "Proposal approved.");
    } catch (err) {
      toast(formatError(err));
    }
  }

  async function handleReject() {
    try {
      await rejectMutation.mutateAsync(proposal.id);
      toast("Proposal rejected.");
    } catch (err) {
      toast(formatError(err));
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm text-foreground">{proposal.bullet}</p>
      {warnings.length > 0 ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Warning: {warnings.join(" ")}
        </p>
      ) : null}
      <dl className="grid gap-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline">Proposed </dt>
          <dd className="inline">{formatTimestamp(proposal.createdAt)}</dd>
        </div>
        {proposal.profileId ? (
          <div>
            <dt className="inline">Profile </dt>
            <dd className="inline font-mono">{proposal.profileId}</dd>
          </div>
        ) : null}
        {proposal.proposedByUserId ? (
          <div>
            <dt className="inline">User </dt>
            <dd className="inline font-mono">{proposal.proposedByUserId}</dd>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`pin-${proposal.id}`}
            checked={pinOnApprove}
            disabled={busy}
            onCheckedChange={setPinOnApprove}
            aria-label="Pin on approve"
          />
          <label htmlFor={`pin-${proposal.id}`} className="text-xs text-muted-foreground">
            Pin on approve
          </label>
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void handleReject()}>
            {rejectMutation.isPending ? <Spinner className="mr-2" /> : null}
            Reject
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void handleApprove()}>
            {approveMutation.isPending ? <Spinner className="mr-2" /> : null}
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OrgMemoryProposalsPanel({ orgId }: { orgId: string }) {
  const { data, isLoading, error } = useOrgMemoryProposals(orgId, "pending");
  const proposals = data?.proposals ?? [];

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading proposals…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {formatError(error)}
      </p>
    );
  }

  if (proposals.length === 0) {
    return <p className="text-xs text-muted-foreground">No pending proposals.</p>;
  }

  return (
    <div className="space-y-3">
      {proposals.map((proposal) => (
        <ProposalRow key={proposal.id} proposal={proposal} orgId={orgId} />
      ))}
    </div>
  );
}
