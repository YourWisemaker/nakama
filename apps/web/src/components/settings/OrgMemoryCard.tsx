import { PinOffIcon, PlusIcon, ArchiveIcon, SaveIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/use-auth";
import {
  useAddOrgMemoryFact,
  useArchiveOrgMemory,
  useOrgMemory,
  useUnpinOrgMemoryFact,
  useUpdateOrgMemory,
} from "@/hooks/use-org-memory";
import { formatError } from "@/lib/client";
import { parsePinnedBullets } from "@/lib/org-memory-bullets";
import { toast } from "@/lib/toast";

const MAX_BODY_BYTES = 256_000;

export function OrgMemoryCard() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id ?? null;
  const isAdmin = activeOrg?.role === "admin";

  const { data, isLoading, error: loadError } = useOrgMemory(isAdmin ? orgId : null);
  const updateMutation = useUpdateOrgMemory(orgId ?? "");
  const addMutation = useAddOrgMemoryFact(orgId ?? "");
  const unpinMutation = useUnpinOrgMemoryFact(orgId ?? "");
  const archiveMutation = useArchiveOrgMemory(orgId ?? "");

  const [draft, setDraft] = useState("");
  const [newFact, setNewFact] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const liveContent = data?.content ?? "";

  useEffect(() => {
    setDraft(liveContent);
  }, [liveContent]);

  const pinnedBullets = useMemo(() => parsePinnedBullets(liveContent), [liveContent]);
  const draftBytes = useMemo(() => new TextEncoder().encode(draft).byteLength, [draft]);

  if (!isAdmin) {
    return null;
  }

  async function handleSave() {
    setFormError(null);
    if (draftBytes > MAX_BODY_BYTES) {
      setFormError(`Content is too large (${draftBytes} bytes; limit ${MAX_BODY_BYTES}).`);
      return;
    }
    try {
      await updateMutation.mutateAsync({ content: draft });
      toast("Org memory saved.");
    } catch (err) {
      setFormError(formatError(err));
    }
  }

  async function handleAddFact() {
    setFormError(null);
    const bullet = newFact.trim();
    if (!bullet) {
      setFormError("Enter a fact to add.");
      return;
    }
    try {
      await addMutation.mutateAsync({ bullet, pin: true });
      setNewFact("");
      toast("Fact added.");
    } catch (err) {
      setFormError(formatError(err));
    }
  }

  async function handleUnpin(bullet: string) {
    setFormError(null);
    try {
      await unpinMutation.mutateAsync({ bullet });
      toast("Unpinned.");
    } catch (err) {
      setFormError(formatError(err));
    }
  }

  async function handleArchive(bullet: string) {
    setFormError(null);
    try {
      const result = await archiveMutation.mutateAsync({ entries: [bullet] });
      toast(`Archived ${result.archived} fact${result.archived === 1 ? "" : "s"}.`);
    } catch (err) {
      setFormError(formatError(err));
    }
  }

  const statusLine = formError ?? (loadError ? formatError(loadError) : null);
  const busy =
    updateMutation.isPending ||
    addMutation.isPending ||
    unpinMutation.isPending ||
    archiveMutation.isPending;

  return (
    <Card className="w-full shadow-none">
      <CardContent className="divide-y divide-border p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-foreground">Org Memory</p>
            <p className="text-xs text-muted-foreground">
              Shared, admin-curated facts injected into every profile in this organization.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="text"
              placeholder="Add a pinned fact…"
              value={newFact}
              disabled={busy}
              onChange={(e) => setNewFact(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAddFact();
                }
              }}
              className="min-w-0 flex-1"
            />
            <Button type="button" size="sm" disabled={busy} onClick={() => void handleAddFact()}>
              {addMutation.isPending ? <Spinner className="mr-2" /> : <PlusIcon className="mr-2" />}
              Add
            </Button>
          </div>

          {pinnedBullets.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {pinnedBullets.map((bullet) => (
                <li key={bullet} className="flex items-start justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 text-sm text-foreground">{bullet}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void handleUnpin(bullet)}
                      title="Unpin (move out of pinned section)"
                    >
                      <PinOffIcon className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void handleArchive(bullet)}
                      title="Archive"
                    >
                      <ArchiveIcon className="size-4" aria-hidden />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No pinned facts yet.</p>
          )}
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Raw editor</p>
            <p className="text-xs text-muted-foreground">
              Replace the entire org memory file. Keep the <code># Org Memory</code> /{" "}
              <code>## Pinned</code> structure. {draftBytes} bytes.
            </p>
          </div>
          <Textarea
            value={draft}
            disabled={busy || isLoading}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            placeholder={"# Org Memory\n\n## Pinned\n- ..."}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {isLoading ? "Loading…" : `${pinnedBullets.length} pinned fact(s)`}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={busy || draft === liveContent}
              onClick={() => void handleSave()}
            >
              {updateMutation.isPending ? <Spinner className="mr-2" /> : <SaveIcon className="mr-2" />}
              Save
            </Button>
          </div>
        </div>

        {statusLine ? (
          <div className="px-4 py-2">
            <p className="text-sm text-destructive" role="alert">
              {statusLine}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
