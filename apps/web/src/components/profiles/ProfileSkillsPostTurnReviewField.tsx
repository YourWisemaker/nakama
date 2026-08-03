import { useState } from "react";
import type { ProfileDetail } from "@nakama/core/contract";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/use-auth";
import { useUpdateProfileMutation } from "@/hooks/use-resource-mutations";
import { formatError } from "@/lib/client";
import { toast } from "@/lib/toast";

type OverrideValue = "inherit" | "on" | "off";

function toOverrideValue(value: boolean | null | undefined): OverrideValue {
  if (value === true) {
    return "on";
  }
  if (value === false) {
    return "off";
  }
  return "inherit";
}

function fromOverrideValue(value: OverrideValue): boolean | null {
  if (value === "on") {
    return true;
  }
  if (value === "off") {
    return false;
  }
  return null;
}

export function ProfileSkillsPostTurnReviewField({
  profile,
  disabled = false,
}: {
  profile: ProfileDetail;
  disabled?: boolean;
}) {
  return (
    <ProfileSkillsPostTurnReviewFieldBody
      key={`${profile.id}:${String(profile.skillsPostTurnReview)}`}
      profile={profile}
      disabled={disabled}
    />
  );
}

function ProfileSkillsPostTurnReviewFieldBody({
  profile,
  disabled = false,
}: {
  profile: ProfileDetail;
  disabled?: boolean;
}) {
  const { activeOrg } = useAuth();
  const updateMutation = useUpdateProfileMutation();
  const [value, setValue] = useState<OverrideValue>(() =>
    toOverrideValue(profile.skillsPostTurnReview),
  );
  const busy = updateMutation.isPending;

  if (!activeOrg || activeOrg.role !== "admin") {
    return null;
  }

  async function handleChange(nextValue: OverrideValue) {
    setValue(nextValue);
    try {
      await updateMutation.mutateAsync({
        profileId: profile.id,
        input: { skillsPostTurnReview: fromOverrideValue(nextValue) },
      });
      toast("Post-turn skill review setting saved.");
    } catch (err) {
      setValue(toOverrideValue(profile.skillsPostTurnReview));
      toast(formatError(err));
    }
  }

  return (
    <div className="mb-3 rounded-md border border-border p-3 sm:p-4">
      <label
        htmlFor="profile-skills-post-turn-review"
        className="mb-1 block text-xs font-medium text-muted-foreground"
      >
        Post-turn skill review
      </label>
      <div className="flex items-center gap-2">
        <Select
          value={value}
          disabled={disabled || busy}
          onValueChange={(next) => {
            if (!next) {
              return;
            }
            void handleChange(next as OverrideValue);
          }}
        >
          <SelectTrigger id="profile-skills-post-turn-review" className="h-8 max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">Inherit org default</SelectItem>
            <SelectItem value="on">Enable review</SelectItem>
            <SelectItem value="off">Disable review</SelectItem>
          </SelectContent>
        </Select>
        {busy ? <Spinner /> : null}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Overrides the org-wide post-turn review setting for this profile only. Separate from skill
        write approval.
      </p>
    </div>
  );
}
