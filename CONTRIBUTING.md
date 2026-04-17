# Contributing to Aiden

Aiden's core (planner, router, memory engine, agent loop) is
proprietary software owned by Taracod. The community skills
library is open-source under Apache-2.0 and welcomes contributions.

## What you can contribute

### Skills (open for contribution)
Skills are markdown instruction files that teach Aiden how to do
specific tasks. If you've built a useful workflow — like
controlling a piece of software, scraping a specific site,
handling a domain-specific data format — you can contribute it
as a skill.

See /skills/SKILL_TEMPLATE.md for the required structure.

### Documentation (open for contribution)
Typo fixes, clearer explanations, missing edge cases — all welcome.

### Core Aiden (not open for contribution)
The core agent loop, planner, router, memory system, and
associated infrastructure are proprietary and not open for
community contributions at this time.

## How to contribute a skill

Once the public skills repo opens (expected after Aiden v3.7), the
flow will be:

1. Fork taracodlabs/aiden-skills
2. Create a new branch: `git checkout -b skill/<name>`
3. Copy /skills/SKILL_TEMPLATE.md to /skills/<your-skill-name>/SKILL.md
4. Fill in the template
5. Test locally: place the skill in your Aiden workspace and run it
6. Open a PR with your skill and a short description of what it does

Until the public skills repo opens, skill contributions are
tracked via GitHub issues at github.com/taracodlabs/aiden-releases.

## Code of conduct

Be respectful. Be constructive. Don't submit skills that enable
harm, violate platform terms of service (e.g., jailbreak tooling,
scraping that violates target site ToS), or facilitate illegal
activity.

## License

Contributions to skills and documentation are licensed under
Apache-2.0. By contributing, you agree your contribution may be
distributed under this license.

For contributions larger than a typo fix, you'll be asked to sign
a Contributor License Agreement (CLA) via the CLA bot. This
confirms you have the right to contribute what you're contributing.

## Questions?

Open an issue at github.com/taracodlabs/aiden-releases or reach out
via the Ship It newsletter at shipit.taracod.com.
