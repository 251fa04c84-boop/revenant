# Revenant

**Raise your dead dependencies.** Paste a `package.json` (or a public GitHub repo) and Revenant finds the npm packages nobody maintains any more, explains why, and gives you a plan to replace each one.

Built for Kiroween 2026, **Resurrection** category: it brings abandoned software back to life by showing exactly how to move on from it.

## What it does
- Reads `dependencies`, `devDependencies`, `peerDependencies` and `optionalDependencies`; resolves `npm:` aliases; skips `file:`, `workspace:` and git specifiers and tells you so.
- Checks each package against the public npm registry and labels it **alive, fading, restless or dead** with a plain-language reason (deprecation notice, time since last release, major versions behind).
- Separates *abandoned* from *finished*: very widely used old packages are not called dead on age alone.
- Shows a headstone per package. "Show resurrection" reveals replacements, effort, migration notes and a before/after diff.
- Generates `npm uninstall` / `npm install` commands that respect dev vs production dependencies, and a Markdown plan you can paste into an issue or PR.
- Runs entirely in your browser. Your manifest never leaves the page; only package names go to the npm registry.

## Run it
```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # typecheck + static build in dist/
```
It is a static site: deploy `dist/` anywhere (a GitHub Pages workflow is included).

## How classification works
| Signal | Effect |
| --- | --- |
| Latest version deprecated on npm | dead |
| No release for 18 / 30 / 48 months | fading / restless / dead |
| 1M+ weekly downloads | age alone caps at fading ("finished") |
| 48+ months and under 100K weekly downloads | dead (with unknown downloads: restless) |
| Maintainers call it legacy (e.g. moment, Create React App) | at least restless |
| 2+ major versions behind | noted in the reasons |

Score = 100 × (1 − weighted share of known packages), weights 0 / 0.25 / 0.5 / 1.

## Built with Kiro
The `/.kiro` folder holds the spec (requirements, design, tasks), steering docs and an agent hook that runs the tests when verdict logic changes. See `docs/KIRO.md`.

## Limits
- Replacements come from a hand-curated list (53 packages). Anything else gets a neutral "look for an alternative" note.
- Registry data only: no source-code analysis, no vulnerability database.
- Branch names containing `/` are not supported in GitHub URLs.

MIT licensed.
