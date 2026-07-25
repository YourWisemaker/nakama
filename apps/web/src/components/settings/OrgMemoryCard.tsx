import { PencilIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
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
import { toast } from "@/lib/toast";

const MAX_BODY_BYTES = 256_000;

const orgMemoryPreviewMarkdownClassName =
  "max-w-none text-sm [&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-xs [&_h2]:font-medium [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-muted-foreground [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-xs [&_h4]:font-medium";

export function OrgMemoryCard() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id ?? null;
  const isAdmin = activeOrg?.role === "admin";

  const { data, isLoading, error: loadError } = useOrgMemory(isAdmin ? orgId : null);
  const updateMutation = useUpdateOrgMemory(orgId ?? "");

  const [draft, setDraft] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const liveContent = data?.content ?? "";
  const draftBytes = new TextEncoder().encode(draft).byteLength;

  useEffect(() => {
    setPreviewExpanded(false);
  }, [liveContent]);

  useLayoutEffect(() => {
    const element = previewRef.current;
    if (!element || previewExpanded) {
      return;
    }

    const checkTruncation = () => {
      setPreviewTruncated(element.scrollHeight > element.clientHeight + 1);
    };

    checkTruncation();

    const observer = new ResizeObserver(checkTruncation);
    observer.observe(element);

    return () => observer.disconnect();
  }, [liveContent, previewExpanded]);

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
            ) : liveContent.trim() ? (
              <div className="space-y-2">
                <div
                  ref={previewRef}
                  className={previewExpanded ? "relative" : "relative max-h-48 overflow-hidden"}
                >
                  <MessageResponse className={orgMemoryPreviewMarkdownClassName}>
                    {liveContent}
                  </MessageResponse>
                  {!previewExpanded ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent"
                      aria-hidden
                    />
                  ) : null}
                </div>
                {previewTruncated || previewExpanded ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setPreviewExpanded((expanded) => !expanded)}
                  >
                    {previewExpanded ? "See less" : "See more"}
                  </Button>
                ) : null}
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
        <DialogContent className="flex max-h-[min(90dvh,85vh)] w-[calc(100%-1.5rem)] flex-col gap-4 p-4 sm:max-w-3xl sm:gap-6 sm:p-6">
          <DialogHeader className="pr-8">
            <DialogTitle>Edit org memory</DialogTitle>
            <DialogDescription>
              Raw Markdown. Keep the ## Org Memory / ## Pinned structure.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <Textarea
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              className="field-sizing-fixed min-h-[min(52dvh,22rem)] flex-1 resize-none overflow-y-auto font-mono text-xs leading-relaxed sm:min-h-[min(58dvh,26rem)]"
              placeholder={"## Org Memory\n\n## Pinned\n- ..."}
              autoFocus
            />
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border bg-transparent p-0 pt-4">
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{draftBytes} bytes</span>
                <Button type="submit" size="sm" disabled={busy || !dirty}>
                  {updateMutation.isPending ? <Spinner className="mr-2" /> : null}
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
