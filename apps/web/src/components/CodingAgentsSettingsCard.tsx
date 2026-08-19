import type {
  CodingHarnessLoginCommand,
  CodingHarnessSettingsResponse,
} from "@nakama/core/contract";
import {
  CheckmarkCircle01Icon,
  Copy01Icon,
  Shield01Icon,
  SparklesIcon,
} from "hugeicons-react";
import { useEffect, useState } from "react";
import { CodingAgentLogo } from "@/components/coding-agent-logos";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { client, formatError } from "@/lib/client";
import { cn } from "@/lib/utils";

function CopyCommandButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      // Clipboard may be unavailable outside a secure context.
    }
  }

  const iconTransition =
    "absolute inset-0 size-3.5 transition-[opacity,transform,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)]";

  return (
    <Button
      aria-label={copied ? `Copied ${command}` : `Copy ${command}`}
      className="relative size-8 text-muted-foreground after:absolute after:inset-[-6px] hover:text-foreground"
      onClick={() => void handleCopy()}
      size="icon"
      type="button"
      variant="ghost"
    >
      <span aria-hidden className="relative size-3.5 shrink-0">
        <Copy01Icon
          className={cn(
            iconTransition,
            copied
              ? "scale-[0.25] opacity-0 blur-[4px]"
              : "scale-100 opacity-100 blur-0"
          )}
          strokeWidth={1.75}
        />
        <CheckmarkCircle01Icon
          className={cn(
            iconTransition,
            "text-emerald-600 dark:text-emerald-400",
            copied
              ? "scale-100 opacity-100 blur-0"
              : "scale-[0.25] opacity-0 blur-[4px]"
          )}
          strokeWidth={1.75}
        />
      </span>
    </Button>
  );
}

function LoginCommandRow({ item }: { item: CodingHarnessLoginCommand }) {
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <CodingAgentLogo command={item.command} name={item.name} />
      <span className="min-w-0 truncate font-medium text-foreground text-sm sm:shrink-0">
        {item.name}
      </span>
      <code className="min-w-0 flex-1 truncate text-right font-mono text-muted-foreground text-xs">
        {item.command}
      </code>
      <CopyCommandButton command={item.command} />
    </li>
  );
}

export function CodingAgentsSettingsCard() {
  const [settings, setSettings] =
    useState<CodingHarnessSettingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void client
      .getCodingHarnessSettings()
      .then((response) => {
        if (!cancelled) {
          setSettings(response);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(formatError(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(providerPassthroughEnabled: boolean) {
    setSaving(true);
    setError(null);

    try {
      const response = await client.setCodingHarnessSettings(
        providerPassthroughEnabled
      );
      setSettings(response);
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setSaving(false);
    }
  }

  if (!(settings || error)) {
    return (
      <div className="flex min-h-32 items-center justify-center text-muted-foreground">
        <Spinner className="size-5" />
      </div>
    );
  }

  const passthrough = settings?.providerPassthroughEnabled !== false;
  const loginCommands = settings?.loginCommands ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-semibold text-foreground text-xl leading-tight [text-wrap:balance]">
          Coding agents
        </h2>
        <p className="text-muted-foreground text-sm leading-snug [text-wrap:pretty]">
          Control how Nakama integrates with coding agent CLIs.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-primary/35">
        <div className="flex items-start justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
            >
              <Shield01Icon className="size-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium text-foreground text-sm">
                Use Nakama provider
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed [text-wrap:pretty]">
                Inject Nakama provider credentials into coding agent CLIs when
                they are spawned.
              </p>
            </div>
          </div>
          <Switch
            aria-label="Use Nakama provider"
            checked={passthrough}
            className="mt-1"
            disabled={saving || !settings}
            onCheckedChange={toggle}
          />
        </div>
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {loginCommands.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-0.5 font-medium text-2xs text-muted-foreground uppercase tracking-[0.12em]">
            Login commands (when disabled)
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {loginCommands.map((item) => (
              <LoginCommandRow item={item} key={item.command} />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-primary text-xs leading-relaxed [text-wrap:pretty]">
        <SparklesIcon
          aria-hidden
          className="mt-0.5 size-3.5 shrink-0"
          strokeWidth={1.75}
        />
        Cursor Agent uses your host session and never receives Nakama
        credentials.
      </p>
    </div>
  );
}
