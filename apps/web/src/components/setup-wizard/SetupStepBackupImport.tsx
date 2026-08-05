import type { DataImportPreviewResponse } from "@nakama/core/contract";
import { AlertTriangleIcon, RotateCcwIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  canRestoreDataImport,
  formatDataPortabilityBytes,
  usePreviewSetupDataImport,
  useRestoreSetupDataImport,
} from "@/hooks/use-data-portability";
import { formatError } from "@/lib/client";
import { cn } from "@/lib/utils";

interface SetupStepBackupImportProps {
  initialFile?: File | null;
  onBack: () => void;
  onRestored: () => void;
}

export function SetupStepBackupImport({
  initialFile = null,
  onBack,
  onRestored,
}: SetupStepBackupImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DataImportPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewMutation = usePreviewSetupDataImport();
  const restoreMutation = useRestoreSetupDataImport();
  const isBusy = previewMutation.isPending || restoreMutation.isPending;
  const restoreAvailable = canRestoreDataImport({
    selectedFile,
    previewReady: Boolean(preview),
    pending: restoreMutation.isPending,
  });

  async function handlePreview(file: File | null) {
    setSelectedFile(file);
    setPreview(null);
    setError(null);

    if (!file) {
      return;
    }

    try {
      setPreview(await previewMutation.mutateAsync(file));
    } catch (err) {
      setError(formatError(err));
    }
  }

  useEffect(() => {
    if (!initialFile) {
      return;
    }

    let cancelled = false;
    setSelectedFile(initialFile);
    setPreview(null);
    setError(null);

    void previewMutation
      .mutateAsync(initialFile)
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(formatError(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialFile, previewMutation]);

  async function handleRestore() {
    if (!selectedFile || !preview) {
      return;
    }

    setError(null);

    try {
      await restoreMutation.mutateAsync({ file: selectedFile, confirm: true });
      onRestored();
    } catch (err) {
      setError(formatError(err));
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Restore backup</p>
          <Button type="button" size="sm" disabled={isBusy} onClick={() => inputRef.current?.click()}>
            {previewMutation.isPending ? (
              <Spinner className="size-3.5" />
            ) : (
              <UploadIcon className="size-3.5" aria-hidden />
            )}
            Choose ZIP
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            disabled={isBusy}
            className="sr-only"
            aria-label="Import backup ZIP file"
            onChange={(event) => void handlePreview(event.target.files?.[0] ?? null)}
          />
        </div>

        {selectedFile ? (
          <p className="text-xs text-muted-foreground">
            {previewMutation.isPending ? "Inspecting " : "Selected: "}
            <span className="font-medium text-foreground">{selectedFile.name}</span>
          </p>
        ) : null}

        {preview ? (
          <div className="rounded-md border border-border bg-background">
            <dl className="grid gap-px overflow-hidden rounded-md bg-border text-sm sm:grid-cols-2">
              <PreviewStat label="Created" value={formatDate(preview.manifest.createdAt)} />
              <PreviewStat label="Files" value={String(preview.archiveFileCount)} />
              <PreviewStat label="Size" value={formatDataPortabilityBytes(preview.archiveTotalBytes)} />
              <PreviewStat
                label="Action"
                value={preview.willReplaceRoot ? "Replace current data" : "Create data root"}
              />
            </dl>
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Top-level paths: {preview.topLevelPaths.join(", ") || "none"}
              </p>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={!restoreAvailable}
                onClick={() => void handleRestore()}
              >
                {restoreMutation.isPending ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <RotateCcwIcon className="size-3.5" aria-hidden />
                )}
                Restore ZIP
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
              "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        ) : null}

        <Button type="button" variant="outline" className="w-full" onClick={onBack} disabled={isBusy}>
          Back to account setup
        </Button>
      </div>
    </Card>
  );
}

export function SetupBackupRestoreComplete() {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <p className="text-sm text-foreground">Backup restored. Restart Nakama to finish setup.</p>
        <p className="text-sm text-muted-foreground">
          After restart, sign in with your existing account. If provider setup is still required, the
          wizard will continue from there.
        </p>
        <Button type="button" className="w-full" render={<Link to="/login" />}>
          Go to sign in
        </Button>
      </div>
    </Card>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
