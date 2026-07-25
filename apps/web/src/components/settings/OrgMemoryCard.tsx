import { PencilIcon, SaveIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/use-auth";
import { useOrgMemory, useUpdateOrgMemory } from "@/hooks/use-org-memory";
import { formatError } from "@/lib/client";
import { parseOrgMemorySections } from "@/lib/org-memory-bullets";
import { toast } from "@/lib/toast";

const MAX_BODY_BYTES = 256_000;

export function OrgMemoryCard() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id ?? null;
  const isAdmin = activeOrg?.role === "admin";

  const { data, isLoading, error: loadError } = useOrgMemory(isAdmin ? orgId : null);
  const updateMutation = useUpdateOrgMemory(orgId ?? "");

  const [draft, setDraft] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const liveContent = data?.content ?? "";
  const sections = parseOrgMemorySections(liveContent);
  const draftBytes = new TextEncoder().encode(draft).byteLength;

  if (!isAdmin) {
    return null;
  }

  function openEdit() {
    setFormError(null);
    setDraft(liveContent);
    setEditOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (draftBytes > MAX_BODY_BYTES) {
      setFormError(`Content is too large (${draftBytes} bytes; limit ${MAX_BODY_BYTES}).`);
      return;
    }
    try {
      await updateMutation.mutateAsync({ content: draft });
      setEditOpen(false);
      toast("Org memory saved.");
    } catch (err) {
      setFormError(formatError(err));
    }
  }

  const statusLine = formError ?? (loadError ? formatError(loadError) : null);
  const busy = updateMutation.isPending;
  const dirty = draft !== liveContent;

  return (
    <>
      <Card className="w-full shadow-none">
        <CardContent className="divide-y divide-border p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-foreground">Org Memory</p>
              <p className="text-xs text-muted-foreground">
                Shared, admin-curated facts injected into every profile in this organization.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={openEdit}>
              <PencilIcon className="size-3.5" aria-hidden />
              Edit
            </Button>
          </div>

          <div className="px-4 py-3">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : sections.length > 0 ? (
              <div className="space-y-4">
                {sections.map((section, i) => (
                  <div
                    key={section.title || `section-${i}`}
                    className="space-y-1.5"
                  >
                    {section.title ? (
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {section.title}
                      </p>
                    ) : null}
                    {section.bullets.length > 0 ? (
                      <ul className="space-y-2">
                        {section.bullets.map((bullet, j) => (
                          <li
                            key={`${bullet}-${j}`}
                            className="flex items-start gap-2 text-sm text-foreground"
                          >
                            <span
                              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                              aria-hidden
                            />
                            <span className="min-w-0">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {section.text.length > 0 ? (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {section.text.map((line, j) => (
                          <p key={`${line}-${j}`} className="min-w-0">
                            {line}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No pinned facts yet.</p>
            )}
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

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setDraft("");
            setFormError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit org memory</DialogTitle>
            <DialogDescription>
              Raw Markdown. Keep the # Org Memory / ## Pinned structure.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="space-y-4"
          >
            <Textarea
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              placeholder={"# Org Memory\n\n## Pinned\n- ..."}
              autoFocus
            />
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <DialogFooter>
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{draftBytes} bytes</span>
                <Button type="submit" size="sm" disabled={busy || !dirty}>
                  {updateMutation.isPending ? (
                    <Spinner className="mr-2" />
                  ) : (
                    <SaveIcon className="mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
