# Building Aiden Skills

Skills are the easiest way to contribute.
No core code changes needed.

## Structure
```
workspace/skills/approved/your-skill-name/
  SKILL.md      # human-readable instructions
  skill.json    # agentskills.io manifest
  (optional) handler.ts  # custom tool logic
```

## SKILL.md template
```markdown
---
name: your-skill-name
version: 1.0.0
author: your-name
license: Apache-2.0
tools_used: web_search, notify
trigger_phrases:
  - "phrase that invokes this skill"
  - "another trigger phrase"
tags: [category]
---

# Skill Name

## When to use
One sentence describing when Aiden should use this.

## Steps
1. First do X using tool Y
2. Then do Z
3. Return result to user

## Example
User: "trigger phrase"
Result: what the user expects to see
```

## skill.json template
```json
{
  "name": "your-skill-name",
  "version": "1.0.0",
  "description": "One line description",
  "author": "your-name",
  "license": "Apache-2.0",
  "tools": ["web_search", "notify"],
  "trigger_phrases": ["phrase that invokes this skill"],
  "compatible_agents": ["aiden", "hermes", "openclaw"],
  "tags": ["category"]
}
```

## Testing your skill
1. Place in workspace/skills/approved/
2. Run: /skills validate your-skill-name
3. Test: type the trigger phrase in CLI
4. Submit PR with skill folder

## Publishing to registry
Once your PR is merged, maintainer runs:
  /publish your-skill-name
