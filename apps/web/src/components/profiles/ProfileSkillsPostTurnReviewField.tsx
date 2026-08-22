import type { ProfileDetail } from "@nakama/core/contract";
import { ProfileOrgBooleanOverrideField } from "@/components/profiles/ProfileOrgBooleanOverrideField";

export function ProfileSkillsPostTurnReviewField({
  profile,
  disabled = false,
}: {
  profile: ProfileDetail;
  disabled?: boolean;
}) {
  return (
    <ProfileOrgBooleanOverrideField
      disabled={disabled}
      field="skillsPostTurnReview"
      id="profile-skills-post-turn-review"
      label="Post-turn skill review"
      offLabel="Disable review"
      onLabel="Enable review"
      profile={profile}
      savedToast="Post-turn skill review setting saved."
    />
  );
}
