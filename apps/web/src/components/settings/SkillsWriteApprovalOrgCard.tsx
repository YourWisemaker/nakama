import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/use-auth";
import { formatError } from "@/lib/client";
import { toast } from "@/lib/toast";

export function SkillsWriteApprovalOrgCard() {
  const { activeOrg, updateOrg } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!activeOrg || activeOrg.role !== "admin") {
    return null;
  }

  const enabled = activeOrg.skillsWriteApproval === true;

  async function handleToggle(checked: boolean) {
    setBusy(true);
    try {
      await updateOrg(activeOrg!.id, { skillsWriteApproval: checked });
      toast(checked ? "Skill write approval enabled." : "Skill write approval disabled.");
    } catch (err) {
      toast(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full overflow-hidden shadow-none">
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">Skill write approval</p>
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
            When enabled, agent skill creates, patches, and deletes require org admin approval before
            they go live.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {busy ? <Spinner /> : null}
          <Switch
            checked={enabled}
            disabled={busy}
            onCheckedChange={(checked) => void handleToggle(checked)}
            aria-label="Require approval for skill writes"
          />
        </div>
      </div>
    </Card>
  );
}
