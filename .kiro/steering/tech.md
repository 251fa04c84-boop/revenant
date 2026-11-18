# Tech stack and conventions

- TypeScript (strict), Vite, Vitest. No UI framework: plain DOM with a tiny `h()` builder.
- Static site only. No backend, no API keys, no accounts. Must run on any static host.
- Data sources: `registry.npmjs.org` (packument: latest tag, deprecation, publish time), `api.npmjs.org` downloads (best effort, only for stale packages), `raw.githubusercontent.com` (package.json from a repo). All three allow cross-origin requests.

## Rules
1. Pure logic lives in `src/classify.ts`, `src/parse.ts`, `src/plan.ts`; none of it touches the DOM or the network, so it is unit tested.
2. Never use `innerHTML` with registry or user data. Build nodes with `h()` and `textContent`.
3. Package names must follow npm's lowercase naming rules and the 214-character limit; reject reserved names before making registry requests.
4. Verdicts must be explainable: every non-alive verdict carries at least one human-readable reason.
5. Do not call a package dead from age alone unless download evidence says it is little used. Widely used old packages are "finished", not dead.
6. The replacement knowledge base (`src/replacements.ts`) only contains packages that are deprecated, end-of-life, renamed or called legacy by their own maintainers. Every entry needs a factual `why`.
7. Keep `/.kiro` committed. Never add it to .gitignore.

## Commands
- `npm test` runs the unit tests, `npm run build` typechecks and builds, `npm run dev` starts the dev server.
