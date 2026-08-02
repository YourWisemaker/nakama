import type { SkillCreatedBy, SkillDetail, SkillUsageSummary } from "@nakama/core/contract";
import { BookOpenIcon } from "lucide-react";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { formatSessionRelativeTime } from "@/lib/chat-history";

function formatCreatedByLabel(value: SkillCreatedBy): string {
  if (value === "agent") {
    return "Agent";
  }

  if (value === "human") {
    return "Human";
  }

  return "Bundled";
}

function formatUsageTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Never";
  }

  return formatSessionRelativeTime(value);
}

function formatSkillMeta(skill: Pick<SkillDetail, "hasTool" | "disableModelInvocation">): string[] {
  const parts: string[] = [];

  if (skill.hasTool) {
    parts.push("includes tool");
  }

  if (skill.disableModelInvocation) {
    parts.push("explicit invoke only");
  }

  return parts;
}

export function SkillDetailContent({
  skill,
  usageSummary,
  createdBy,
}: {
  skill: SkillDetail;
  usageSummary?: SkillUsageSummary | null;
  createdBy?: SkillCreatedBy | null;
}) {
  const meta = formatSkillMeta(skill);
  const body = skill.body.trim();

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="space-y-2 sm:space-y-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground">
            <BookOpenIcon className="size-4" aria-hidden />
          </span>
          {skill.name}
        </h1>
        {skill.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {skill.description}
          </p>
        ) : null}
        {meta.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {meta.map((label) => (
              <span
                key={label}
                className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
        {usageSummary || createdBy ? (
          <div className="space-y-1 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {createdBy ? (
              <p>
                <span className="font-medium text-foreground">Created by:</span>{" "}
                {formatCreatedByLabel(createdBy)}
              </p>
            ) : null}
            {usageSummary ? (
              <>
                <p>
                  <span className="font-medium text-foreground">Catalog views:</span>{" "}
                  {usageSummary.viewCount}
                  {usageSummary.lastViewedAt
                    ? ` · last ${formatUsageTimestamp(usageSummary.lastViewedAt)}`
                    : ""}
                </p>
                <p>
                  <span className="font-medium text-foreground">Matches:</span>{" "}
                  {usageSummary.useCount}
                  {usageSummary.lastUsedAt
                    ? ` · last ${formatUsageTimestamp(usageSummary.lastUsedAt)}`
                    : ""}
                </p>
                <p>
                  <span className="font-medium text-foreground">Updates:</span>{" "}
                  {usageSummary.patchCount}
                  {usageSummary.lastPatchedAt
                    ? ` · last ${formatUsageTimestamp(usageSummary.lastPatchedAt)}`
                    : ""}
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </header>

      {body ? (
        <CodeBlock
          code={body}
          lang="markdown"
          className="rounded-lg border border-border [&>div:last-child]:max-h-[min(70vh,48rem)]"
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No skill body content.
        </p>
      )}
    </div>
  );
}
