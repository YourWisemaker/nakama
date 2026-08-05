import type { DataImportPreviewResponse } from "@nakama/core/contract";
import {
  AlertTriangleIcon,
  DownloadIcon,
  RotateCcwIcon,
  UploadIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  formatDataPortabilityBytes,
  canRestoreDataImport,
  useExportData,
  usePreviewDataImport,
  useRestoreDataImport,
} from "@/hooks/use-data-portability";
import { formatError } from "@/lib/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function DataPortabilityPanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DataImportPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exportMutation = useExportData();
  const previewMutation = usePreviewDataImport();
  const restoreMutation = useRestoreDataImport();
  const isBusy =
    exportMutation.isPending || previewMutation.isPending || restoreMutation.isPending;
  const restoreAvailable = canRestoreDataImport({
    selectedFile,
    previewReady: Boolean(preview),
    pending: restoreMutation.isPending,
  });

  async function handleExport() {
    setError(null);
    try {
      const result = await exportMutation.mutateAsync();
      downloadArchive(result.filename, result.data);
      toast("Export ready.");
    } catch (err) {
      setError(formatError(err));
    }
  }

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

  async function handleRestore() {
    if (!selectedFile || !preview) {
      return;
    }

    setError(null);
    try {
      await restoreMutation.mutateAsync({ file: selectedFile, confirm: true });
      toast("Import restored.");
      setPreview(null);
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err) {
      setError(formatError(err));
    }
  }

  return (
    <div className="min-w-0 divide-y divide-border">
      <section className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-balance text-sm font-medium text-foreground">Export</p>
          <p className="text-pretty text-xs text-muted-foreground">ZIP backup of the data root</p>
        </div>
        <Button type="button" size="sm" onClick={handleExport} disabled={isBusy}>
          <ActionIcon pending={exportMutation.isPending} idle={DownloadIcon} />
          Export ZIP
        </Button>
      </section>

      <section className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-balance text-sm font-medium text-foreground">Import</p>
            <p className="text-pretty text-xs text-muted-foreground">
              Review a ZIP backup before restoring
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
          >
            <ActionIcon pending={previewMutation.isPending} idle={UploadIcon} />
            Import ZIP
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
          <p className="text-pretty text-xs text-muted-foreground">
            {previewMutation.isPending ? "Inspecting " : "Selected: "}
            <span className="font-medium text-foreground">{selectedFile.name}</span>
          </p>
        ) : null}

        {preview ? (
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <dl className="grid gap-px bg-border text-sm sm:grid-cols-2">
              <PreviewStat label="Created" value={formatDate(preview.manifest.createdAt)} />
              <PreviewStat
                label="Files"
                value={String(preview.archiveFileCount)}
                tabular
              />
              <PreviewStat
                label="Size"
                value={formatDataPortabilityBytes(preview.archiveTotalBytes)}
                tabular
              />
              <PreviewStat
                label="Action"
                value={preview.willReplaceRoot ? "Replace current data" : "Create data root"}
              />
            </dl>
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-pretty text-xs text-muted-foreground">
                Top-level paths: {preview.topLevelPaths.join(", ") || "none"}
              </p>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={!restoreAvailable}
                onClick={handleRestore}
              >
                <ActionIcon pending={restoreMutation.isPending} idle={RotateCcwIcon} />
                Restore ZIP
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="px-4 py-3">
          <StatusMessage tone="danger" icon={AlertTriangleIcon}>
            {error}
          </StatusMessage>
        </div>
      ) : null}
    </div>
  );
}

function ActionIcon({
  pending,
  idle: IdleIcon,
}: {
  pending: boolean;
  idle: typeof DownloadIcon;
}) {
  return (
    <span className="relative size-3.5 shrink-0" aria-hidden>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          pending ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]",
        )}
      >
        <Spinner className="size-3.5" />
      </span>
      <span
        className={cn(
          "flex items-center justify-center transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          pending ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0",
        )}
      >
        <IdleIcon className="size-3.5" />
      </span>
    </span>
  );
}

function PreviewStat({
  label,
  value,
  tabular = false,
}: {
  label: string;
  value: string;
  tabular?: boolean;
}) {
  return (
    <div className="bg-card p-3">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 truncate text-sm font-medium text-foreground",
          tabular && "tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusMessage({
  children,
  icon: Icon,
  tone,
}: {
  children: string;
  icon: typeof AlertTriangleIcon;
  tone: "danger";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        tone === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="text-pretty">{children}</span>
    </div>
  );
}

function downloadArchive(filename: string, data: ArrayBuffer) {
  const url = URL.createObjectURL(new Blob([data], { type: "application/zip" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
