---
name: manage-skills
description: Create, update, inspect, or manage reusable profile skills with skill_manage. Use when the user wants the agent to remember a repeatable workflow, change a skill, or maintain skill instructions.
include-body-on-match: true
---

Use skills for repeatable procedures and workflows the agent should execute later. Do not use skills for user facts, preferences, or observations; use the `update-profile-memory` skill for those.

## Primary path — skill_manage

When the `skill_manage` tool is available, use it for all `SKILL.md` create/update/delete work:

| Action | When |
|--------|------|
| `create` | New reusable workflow — pass full SKILL.md (`content`) |
| `patch` | Targeted fix — `name`, `old_string`, `new_string` (preferred over rewrite) |
| `delete` | Remove a profile-owned skill — `name` |

`skill_manage` writes under the profile skills directory, validates frontmatter, and **auto-assigns** the skill so it can match on later turns. Bundled and global skills are read-only.

When **write approval** is enabled for the org or profile, `skill_manage` **stages** changes instead of writing immediately. The tool returns `{ staged: true, proposalId, … }` and an org admin must approve the proposal before the skill goes live. Do not re-submit identical pending proposals; wait for review or ask an admin.

Example create content:

```markdown
---
name: skill-name
description: Short trigger description explaining when to use this skill.
include-body-on-match: true
---

Step-by-step instructions for the repeatable workflow.
```

Use lowercase kebab-case names. Prefer `patch` for updates. Do not create broad or vague skills; avoid storing private user facts.

## File tools (secondary)

When `skill_manage` is present, `write_file` / `edit_file` **cannot** write `skills/*/SKILL.md` — they refuse with a redirect to `skill_manage`. You may still use file tools to inspect skills (`read_file`, `search_files`) and to manage non-SKILL.md sidecars under a skill directory.

If `skill_manage` is unavailable, do not invent a skill by writing orphan `SKILL.md` files that will not auto-assign.
