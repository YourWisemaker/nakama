import type { OrgMemoryChangeLogEntry } from "@nakama/core/contract";
import { HistoryIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

function shortenId(value: string): string {
  return value.length > 16 ? `${value.slice(0, 12)}…` : value;
}

function resolveActorLabel(
  userId: string | null,
  members: { userId: string; name?: string | null; email: string }[],
): string | null {
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

function HistoryTimelineItem({
  change,
  orgId,
  actorLabel,
  isCurrent,
  isLast,
}: {
  change: OrgMemoryChangeLogEntry;
  orgId: string;
  actorLabel: string | null;
  isCurrent: boolean;
  isLast: boolean;
}) {
  const restoreMutation = useRestoreOrgMemoryHistory(orgId);
  const busy = restoreMutation.isPending;

  async function handleRevert() {
    try {
      await restoreMutation.mutateAsync(change.id);
      toast("Org memory reverted.");
    } catch (err) {
      toast(formatError(err));
    }
  }

  const relativeTime = formatSessionRelativeTime(change.createdAt);
  const absoluteTime = formatSessionTimestamp(change.createdAt);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center self-stretch">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border",
            isCurrent
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          <HistoryIcon className="size-3.5" strokeWidth={2.25} />
        </div>
        {!isLast ? <div className="mt-2 w-px flex-1 bg-border" /> : null}
      </div>

      <div className={cn("min-w-0 flex-1", !isLast && "pb-4")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {formatActionLabel(change.action)}
              </span>
              {isCurrent ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-foreground">
                  Current
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-foreground">{change.label}</p>
            <p className="text-xs text-muted-foreground">
              <time dateTime={change.createdAt} title={absoluteTime}>
                {relativeTime}
              </time>
              {actorLabel ? <> · {actorLabel}</> : null}
            </p>
          </div>

          {!isCurrent ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={busy}
              onClick={() => void handleRevert()}
            >
              {busy ? <Spinner className="mr-2" /> : null}
              Revert
            </Button>
          ) : null}
        </div>
      </div>
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
          Timeline of every change. Revert to any earlier snapshot.
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
        <p className="px-4 py-3 text-xs text-muted-foreground">No changes logged yet.</p>
      ) : (
        <div className="px-4 py-3">
          {changes.map((change, index) => (
            <HistoryTimelineItem
              key={change.id}
              change={change}
              orgId={orgId}
              actorLabel={resolveActorLabel(change.actorUserId, members)}
              isCurrent={index === 0}
              isLast={index === changes.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
