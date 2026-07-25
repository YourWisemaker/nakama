import { LightbulbIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const TIPS = [
  "Use the Super Bot profile to create your own agents and tools.",
  "Type / to use a skill — a quick shortcut for common tasks.",
  "Switch profiles from the composer to give the agent a different personality and tools.",
];

const TIP_INTERVAL_MS = 10000;

export function ChatTips({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % TIPS.length);
    }, TIP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="px-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-t-xl border-x border-t border-border bg-card/75 px-3 py-2",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LightbulbIcon className="size-3 shrink-0 text-primary/80" aria-hidden />
          <div className="relative min-h-4 flex-1 overflow-hidden">
            <span
              key={index}
              className="chat-tip-slide-up block truncate"
              aria-live="polite"
            >
              {TIPS[index]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
