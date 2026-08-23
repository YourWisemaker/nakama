import { Link01Icon, ViewIcon, ViewOffIcon } from "hugeicons-react";
import { useState } from "react";
import { IntegrationCardShell } from "@/components/integration-settings.shared";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import {
  useErrorTrackingSettings,
  useSaveErrorTrackingSettings,
  useSendErrorTrackingTest,
} from "@/hooks/use-error-tracking";
import { formatError } from "@/lib/client";

function StatusBadge({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-800 text-xs dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
        Sending
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 font-medium text-muted-foreground text-xs">
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-muted-foreground/60"
      />
      Off
    </span>
  );
}

export function ErrorTrackingSettingsCard() {
  const {
    data: settings,
    isLoading,
    error: loadError,
  } = useErrorTrackingSettings();
  const saveMutation = useSaveErrorTrackingSettings();
  const testMutation = useSendErrorTrackingTest();
  const [dsn, setDsn] = useState("");
  const [showDsn, setShowDsn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (isLoading) {
    return (
      <IntegrationCardShell busyLabel="Loading error tracking settings">
        <div className="space-y-2 p-5">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-9 w-full rounded bg-muted" />
        </div>
      </IntegrationCardShell>
    );
  }

  const configured = settings?.configured === true;
  const errorMessage = formError ?? (loadError ? formatError(loadError) : null);

  async function handleSave() {
    setFormError(null);
    setTestResult(null);

    try {
      await saveMutation.mutateAsync({ dsn: dsn.trim() });
      setDsn("");
    } catch (error) {
      setFormError(formatError(error));
    }
  }

  async function handleTest() {
    setFormError(null);
    setTestResult(null);

    try {
      const result = await testMutation.mutateAsync();
      setTestResult(result.message);
    } catch (error) {
      setFormError(formatError(error));
    }
  }

  return (
    <IntegrationCardShell>
      <div className="flex items-start justify-between gap-4 p-5 pb-4">
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold text-base text-foreground leading-tight [text-wrap:balance]">
            Error tracking
          </h2>
          <p className="text-muted-foreground text-sm leading-snug [text-wrap:pretty]">
            Send this instance's own errors to the error tracker you already
            run.
          </p>
        </div>
        <StatusBadge configured={configured} />
      </div>

      <div className="border-border border-t" />

      <div className="space-y-2 p-5">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground text-sm">
            Sentry-compatible DSN
          </p>
          <p className="text-muted-foreground text-sm [text-wrap:pretty]">
            Works with Sentry, GlitchTip, Bugsink and a self-hosted Sentry.
            Leave it empty to send nothing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InputGroup className="h-9 min-w-0 flex-1">
            <InputGroupInput
              autoComplete="off"
              disabled={saveMutation.isPending}
              onChange={(event) => {
                setDsn(event.target.value);
                if (formError) {
                  setFormError(null);
                }
              }}
              placeholder={
                configured && settings?.dsnMasked
                  ? `Saved (${settings.dsnMasked})`
                  : "https://<key>@sentry.example.com/42"
              }
              type={showDsn ? "text" : "password"}
              value={dsn}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={showDsn ? "Hide DSN" : "Show DSN"}
                className="relative before:absolute before:-inset-2 before:content-['']"
                onClick={() => setShowDsn((current) => !current)}
                size="icon-xs"
                type="button"
              >
                {showDsn ? (
                  <ViewOffIcon className="size-4" />
                ) : (
                  <ViewIcon className="size-4" />
                )}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <Button
            className="min-w-[4.5rem] shrink-0"
            disabled={saveMutation.isPending}
            onClick={() => void handleSave()}
            size="sm"
            type="button"
          >
            {saveMutation.isPending ? <Spinner className="size-4" /> : "Save"}
          </Button>
          {/* Without this the only way to learn the DSN is wrong is to wait for
              a real crash. */}
          <Button
            className="shrink-0"
            disabled={!configured || testMutation.isPending}
            onClick={() => void handleTest()}
            size="sm"
            type="button"
            variant="outline"
          >
            {testMutation.isPending ? (
              <Spinner className="size-4" />
            ) : (
              "Send test event"
            )}
          </Button>
        </div>

        {testResult ? (
          <p className="text-muted-foreground text-sm" role="status">
            {testResult}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="text-destructive text-sm" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="px-5 py-3">
        <a
          className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href="https://docs.sentry.io/concepts/key-terms/dsn-explainer/"
          rel="noreferrer"
          target="_blank"
        >
          <Link01Icon aria-hidden className="size-3.5 shrink-0" />
          <span>
            Find your DSN:{" "}
            <span className="font-medium text-primary">
              Project Settings → Client Keys
            </span>
          </span>
        </a>
      </div>
    </IntegrationCardShell>
  );
}
