# Aiden Skills Repo Migration Manifest

This document describes what will be moved to
github.com/taracodlabs/aiden-skills when the public skills repo
opens (planned for v3.7 or later).

## What moves

### Directory migration
Current path: `/skills/*` (in private DevOS repo)
Target path: `/skills/*` (in public aiden-skills repo)

All SKILL.md files with origin: "aiden", "community", or "local"
migrate to the public repo.

### Supporting files that migrate
- /skills/SKILL_TEMPLATE.md
- /skills/AIDEN_CATALOG.md
- /skills/README.md (to be written)

### Files that stay private
- core/skillLoader.ts (loader logic is core IP)
- core/agentShield.ts (security validation is core IP)
- core/skillTeacher.ts (auto-generation logic is core IP)

## How loading works post-split

Aiden runtime will look for skills in TWO locations:
1. Bundled: /skills/ (frozen copy baked into the installer)
2. Fresh: User's installed skills from github.com/taracodlabs/aiden-skills
   via `/skills install <name>` command

User-installed skills live in:
  %APPDATA%/Aiden/skills/  (Windows)
  ~/.aiden/skills/  (Linux/Mac)

Fresh installs from the public repo OVERRIDE bundled versions if
names match, allowing community updates without requiring an Aiden
core release.

## Migration steps (15-min operation when ready)

1. Create public repo: `gh repo create taracodlabs/aiden-skills --public`
2. Copy /skills/ subtree:
   `git subtree push --prefix=skills taracodlabs/aiden-skills main`
3. Add README to public repo explaining structure
4. Add CONTRIBUTING.md (can copy from core repo's CONTRIBUTING.md)
5. Copy /.github/CLA.md to public repo
6. Install CLA Assistant GitHub app on public repo
7. Update Aiden's `/skills install` source to point at
   github.com/taracodlabs/aiden-skills/raw/main/
8. Announce in Ship It newsletter + Twitter

## Announcement template (for when split happens)

> The Aiden skills library is now open source at
> github.com/taracodlabs/aiden-skills 🎉
>
> 50+ skills covering productivity, dev, research, creative, gaming,
> social, and more. Apache-2.0 licensed. Community contributions
> welcome.
>
> Aiden core (planner, memory, agent loop) remains proprietary.
> Think of it as the Docker/Terraform model: engine closed,
> content open.
>
> Want to contribute a skill? See CONTRIBUTING.md.

## Post-split CLI changes

After split, the user experience for skills changes subtly:

- `/skills install <name>` — fetches from public repo
- `/skills update` — checks for updates in public repo
- `/skills publish <path>` — helps user submit PR to public repo
  (opens browser to fork flow)
- `/skills stats` — shows which skills come from bundled vs
  community installs
