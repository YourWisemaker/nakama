import type { OrgMemoryChangeLogEntry } from "@nakama/core/contract";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useOrgMemoryHistory,
  useRestoreOrgMemoryHistory,
  useUndoOrgMemoryChange,
} from "@/hooks/use-org-memory-history";
import { useOrgMembers } from "@/hooks/use-org-members";
import { formatSessionRelativeTime, formatSessionTimestamp } from "@/lib/chat-history";
import { formatError } from "@/lib/client";
import { toast } from "@/lib/toast";

function shortenId(value: string): string {
  return value.length > 16 ? `${value.slice(0, 12)}…` : value;
}

function resolveActorLabel(userId: string | null, members: { userId: string; name?: string | null; email: string }[]): string | null {
  if (!userId) {
    return null;
  }
  const member = members.find((entry) => entry.userId === userId);
  if (!member) {
    return shortenId(userId);
  }
  return member.name?.trim() || member.email;
}

function formatActionLabel(action: OrgMemoryChangeLogEntry["action"]): string {
  switch (action) {
    case "edit":
      return "Edit";
    case "approve":
      return "Approved";
    case "add_fact":
      return "Added";
    case "pin":
      return "Pinned";
    case "unpin":
      return "Unpinned";
    case "archive":
      return "Archived";
    case "restore":
      return "Restored";
    default:
      return action;
  }
}

function HistoryRow({
  change,
  orgId,
  actorLabel,
  canUndo,
}: {
  change: OrgMemoryChangeLogEntry;
  orgId: string;
  actorLabel: string | null;
  canUndo: boolean;
}) {
  const restoreMutation = useRestoreOrgMemoryHistory(orgId);
  const busy = restoreMutation.isPending;

  async function handleRestore() {
    try {
      await restoreMutation.mutateAsync(change.id);
      toast("Org memory restored.");
    } catch (err) {
      toast(formatError(err));
    }
  }

  const relativeTime = formatSessionRelativeTime(change.createdAt);
  const absoluteTime = formatSessionTimestamp(change.createdAt);

  return (
    <div className="flex flex-wrap items-start gap-2 py-2 pl-4 pr-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm text-foreground">{change.label}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{formatActionLabel(change.action)}</span>
          {" · "}
          <time dateTime={change.createdAt} title={absoluteTime}>
            {relativeTime}
          </time>
          {actorLabel ? <> · {actorLabel}</> : null}
        </p>
      </div>
      {canUndo ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={busy}
          onClick={() => void handleRestore()}
        >
          {busy ? <Spinner className="mr-2" /> : null}
          Restore
        </Button>
      ) : null}
    </div>
  );
}

export function OrgMemoryHistoryPanel({ orgId }: { orgId: string }) {
  const { data, isLoading, error } = useOrgMemoryHistory(orgId);
  const undoMutation = useUndoOrgMemoryChange(orgId);
  const { data: membersData } = useOrgMembers(orgId);
  const changes = data?.changes ?? [];
  const members = membersData?.members ?? [];
  const canUndo = changes.length >= 2;

  async function handleUndo() {
    try {
      await undoMutation.mutateAsync();
      toast("Latest org memory change undone.");
    } catch (err) {
      toast(formatError(err));
    }
  }

  if (isLoading) {
    return <p className="px-4 py-2 text-xs text-muted-foreground">Loading history…</p>;
  }

  if (error) {
    return (
      <p className="px-4 py-2 text-sm text-destructive" role="alert">
        {formatError(error)}
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <p className="text-xs text-muted-foreground">
          Snapshots of every change. Restore any revision or undo the latest change.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canUndo || undoMutation.isPending}
          onClick={() => void handleUndo()}
        >
          {undoMutation.isPending ? <Spinner className="mr-2" /> : null}
          Undo latest
        </Button>
      </div>

      {changes.length === 0 ? (
        <p className="px-4 py-2 text-xs text-muted-foreground">No changes logged yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {changes.map((change, index) => (
            <HistoryRow
              key={change.id}
              change={change}
              orgId={orgId}
              actorLabel={resolveActorLabel(change.actorUserId, members)}
              canUndo={index > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
