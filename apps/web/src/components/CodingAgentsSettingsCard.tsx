import type {
  CodingHarnessLoginCommand,
  CodingHarnessSettingsResponse,
} from "@nakama/core/contract";
import {
  CheckmarkCircle01Icon,
  Copy01Icon,
  Shield01Icon,
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
    "absolute inset-0 size-3.5 transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";

  return (
    <Button
      aria-label={copied ? `Copied ${command}` : `Copy ${command}`}
      className="relative size-8 text-muted-foreground after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2 hover:text-foreground"
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
          strokeWidth={1.5}
        />
        <CheckmarkCircle01Icon
          className={cn(
            iconTransition,
            "text-emerald-600 dark:text-emerald-400",
            copied
              ? "scale-100 opacity-100 blur-0"
              : "scale-[0.25] opacity-0 blur-[4px]"
          )}
          strokeWidth={1.5}
        />
      </span>
    </Button>
  );
}

function LoginCommandRow({ item }: { item: CodingHarnessLoginCommand }) {
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5 transition-[background-color] duration-150 ease-out hover:bg-muted/40">
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
      <h2 className="text-balance font-semibold text-foreground text-xl leading-tight">
        Coding agents
      </h2>

      <div className="overflow-hidden rounded-md border border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between gap-4 p-3.5">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary"
            >
              <Shield01Icon className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium text-foreground text-sm">
                Use Nakama keys
              </p>
              <p className="text-pretty text-muted-foreground text-xs leading-relaxed">
                Coding agents use the API keys already set up in Nakama. Turn
                off to use each CLI's own login.
              </p>
            </div>
          </div>
          <Switch
            aria-label="Use Nakama keys"
            checked={passthrough}
            className={cn(
              "relative border-foreground/20 after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2 [&>span]:bg-white",
              passthrough ? "bg-primary" : "bg-foreground/25"
            )}
            disabled={saving || !settings}
            onCheckedChange={toggle}
          />
        </div>
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      <section className="space-y-2">
        <h3 className="px-0.5 font-medium text-2xs text-muted-foreground uppercase tracking-[0.12em]">
          Vendor login
        </h3>
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {loginCommands.map((item) => (
            <LoginCommandRow item={item} key={item.command} />
          ))}
          <li className="flex items-center gap-3 px-3.5 py-2.5">
            <CodingAgentLogo command="agent" name="Cursor Agent" />
            <span className="min-w-0 truncate font-medium text-foreground text-sm sm:shrink-0">
              Cursor Agent
            </span>
            <span className="min-w-0 flex-1 text-pretty text-right text-muted-foreground text-xs">
              Uses host session
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
