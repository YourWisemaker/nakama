import { useEffect, useRef, useState } from "react";
import { AlertTriangleIcon, UploadIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { DataImportPreviewResponse } from "@nakama/core/contract";
import {
  DataImportPreview,
  PendingIcon,
} from "@/components/data-portability/DataImportPreview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  canRestoreDataImport,
  shouldStartInitialFilePreview,
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
  const initialPreviewStartedForRef = useRef<File | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DataImportPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    mutateAsync: previewImport,
    isPending: previewPending,
  } = usePreviewSetupDataImport();
  const restoreMutation = useRestoreSetupDataImport();
  const isBusy = previewPending || restoreMutation.isPending;
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
      setPreview(await previewImport(file));
    } catch (err) {
      setError(formatError(err));
    }
  }

  useEffect(() => {
    if (!initialFile) {
      initialPreviewStartedForRef.current = null;
      return;
    }

    // useMutation's result object changes identity when pending/error state flips.
    // Depend on stable mutateAsync only, and skip if we already started this File.
    if (!shouldStartInitialFilePreview(initialFile, initialPreviewStartedForRef.current)) {
      return;
    }
    initialPreviewStartedForRef.current = initialFile;

    let cancelled = false;
    setSelectedFile(initialFile);
    setPreview(null);
    setError(null);

    void previewImport(initialFile)
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
  }, [initialFile, previewImport]);

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
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-balance text-sm font-medium text-foreground">Restore backup</p>
          <Button
            type="button"
            size="sm"
            variant={selectedFile ? "outline" : "default"}
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
          >
            <PendingIcon pending={previewPending} idle={UploadIcon} />
            {selectedFile ? "Change ZIP" : "Choose ZIP"}
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
          <DataImportPreview
            fileName={selectedFile.name}
            preview={preview}
            inspecting={previewPending}
            restorePending={restoreMutation.isPending}
            restoreDisabled={!restoreAvailable}
            onRestore={() => void handleRestore()}
            restoreLabel="Restore backup"
          />
        ) : null}

        {error ? (
          <div
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
              "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="text-pretty">{error}</span>
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
        <p className="text-pretty text-sm text-foreground">
          Backup restored. Restart Nakama to finish setup.
        </p>
        <p className="text-pretty text-sm text-muted-foreground">
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
