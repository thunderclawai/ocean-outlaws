# FACTORY.md — Ocean Outlaws

## Project
- **Repo:** thunderclawai/ocean-outlaws
- **Stack:** Three.js, vanilla JS (ES modules), static HTML/CSS
- **Description:** Browser-based naval combat game

## Test & Lint
- **Test command:** npx playwright test (when tests exist)
- **Lint command:** none

## Merge Strategy
- Squash merge
- Delete branch after merge

## Branch Naming
- `factory/<issue-number>-<short-slug>`

## Boundaries (do not touch)
- `.github/`
- `FACTORY.md`

## Labels
- `planned` — has implementation plan, ready to build
- `blocked` — skip during factory scan
- `epic` — tracking issue, skip

## Human Checkpoints
- Auto-merge when checks pass
- No human review required

## Deploy
- **Method:** GitHub Pages (auto on push to main)
- **URL:** https://thunderclawai.github.io/ocean-outlaws/

## Budget
- Max open PRs: 2

## Code Style
- Vanilla JS, no TypeScript, no build step
- Three.js loaded via CDN import maps
- ES modules (import/export)
- `var` over `let`/`const` for consistency with Mythical Realms
- Procedural 3D models first, .glb files later
- Keep files under 500 lines — split when approaching
