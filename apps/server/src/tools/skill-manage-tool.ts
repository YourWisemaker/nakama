import {
  type ToolContext,
  type ToolDefinition,
} from "@nakama/core";
import type { SkillsService } from "../services/skills-service";

function requireOrgId(context: ToolContext): string {
  const orgId = context.orgId?.trim();
  if (!orgId) {
    throw new Error("Organization context is required.");
  }
  return orgId;
}

function requireProfileId(context: ToolContext): string {
  const profileId = context.profileId?.trim();
  if (!profileId) {
    throw new Error("Profile context is required.");
  }
  return profileId;
}

/**
 * Deny-by-default role gate for skill_manage. Viewers are blocked; an undefined
 * role also blocks — same pattern as org-memory tools.
 */
function requireSkillManageAccess(context: ToolContext): {
  orgId: string;
  profileId: string;
} {
  if (context.automationId?.trim()) {
    throw new Error("skill_manage is not available during automation runs.");
  }

  const channel = context.channel;
  if (
    channel !== undefined &&
    channel !== "web" &&
    channel !== "cli"
  ) {
    throw new Error("skill_manage is only available in interactive web or CLI chat.");
  }

  const orgId = requireOrgId(context);
  const profileId = requireProfileId(context);
  const role = context.orgRole;
  if (role === undefined || role === null) {
    throw new Error("skill_manage requires an organization role.");
  }
  if (role === "viewer") {
    throw new Error("Viewers cannot manage skills.");
  }
  return { orgId, profileId };
}

function readRawString(input: unknown, key: string): string | null {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return null;
  }
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function readString(input: unknown, key: string): string | null {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return null;
  }
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readAction(input: unknown): "create" | "patch" | "delete" {
  if (typeof input !== "object" || input === null || !("action" in input)) {
    throw new Error("action is required (create | patch | delete).");
  }
  const value = (input as Record<string, unknown>).action;
  if (value === "create" || value === "patch" || value === "delete") {
    return value;
  }
  throw new Error("action must be create, patch, or delete.");
}

function skillManageResult(options: {
  action: "create" | "patch" | "delete";
  name: string;
  assigned: boolean;
  description?: string;
  created?: boolean;
}) {
  return {
    action: options.action,
    name: options.name,
    assigned: options.assigned,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.created !== undefined ? { created: options.created } : {}),
    matchHint:
      "The skill is assigned for this profile. Keyword match and /skill work on later turns; the baked session skills catalog list may refresh on a new session.",
  };
}

export function createSkillManageTools(service: SkillsService): ToolDefinition[] {
  return [
    {
      name: "skill_manage",
      description:
        "Create, patch, or delete reusable profile skills (SKILL.md under the profile skills directory) with auto-assign. Prefer patch with unique old_string/new_string over rewriting whole files. Crystallize a skill after complex multi-step success (about 5+ tool calls), error recovery, or when the user corrects your approach — do not dump procedures into MEMORY.md.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "patch", "delete"],
            description: "create = new/adopt skill; patch = targeted edit; delete = remove profile-owned skill.",
          },
          content: {
            type: "string",
            description: "Full SKILL.md markdown including YAML frontmatter. Required for create.",
          },
          name: {
            type: "string",
            description: "Skill name (kebab-case). Required for patch and delete.",
          },
          old_string: {
            type: "string",
            description: "Exact unique substring to replace in SKILL.md. Required for patch.",
          },
          new_string: {
            type: "string",
            description: "Replacement text for old_string. Required for patch (may be empty).",
          },
        },
        required: ["action"],
        additionalProperties: false,
      },
      parallelSafe: false,
      async run(input, context: ToolContext) {
        const { orgId, profileId } = requireSkillManageAccess(context);
        const action = readAction(input);

        if (action === "create") {
          const content = readRawString(input, "content");
          if (!content?.trim()) {
            throw new Error("content is required for create (full SKILL.md markdown).");
          }

          const response = await service.createAndAssignRawSkillToProfile(
            orgId,
            profileId,
            content,
          );

          return skillManageResult({
            action: "create",
            name: response.skill.name,
            assigned: true,
            description: response.skill.description,
            created: response.created,
          });
        }

        if (action === "patch") {
          const name = readString(input, "name");
          const oldString = readRawString(input, "old_string");
          const newString = readRawString(input, "new_string");

          if (!name) {
            throw new Error("name is required for patch.");
          }
          if (oldString === null || oldString === "") {
            throw new Error("old_string is required for patch.");
          }
          if (newString === null) {
            throw new Error("new_string is required for patch.");
          }

          const response = await service.patchAssignedProfileSkill(
            orgId,
            profileId,
            name,
            oldString,
            newString,
          );

          return skillManageResult({
            action: "patch",
            name: response.skill.name,
            assigned: true,
            description: response.skill.description,
          });
        }

        const name = readString(input, "name");
        if (!name) {
          throw new Error("name is required for delete.");
        }

        await service.deleteAssignedProfileSkill(orgId, profileId, name);

        return skillManageResult({
          action: "delete",
          name,
          assigned: false,
        });
      },
    },
  ];
}
