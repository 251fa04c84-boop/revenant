# Project structure

```
index.html            entry page
src/main.ts           UI wiring and rendering (DOM only)
src/style.css         headstone design system
src/parse.ts          package.json and GitHub URL parsing
src/registry.ts       npm registry client, concurrency pool
src/classify.ts       verdicts, health score, sorting
src/replacements.ts   curated resurrection knowledge base
src/plan.ts           migration commands and Markdown plan
src/example.ts        demo manifest
tests/                Vitest unit tests
.kiro/specs/          requirements, design and tasks for the app
.kiro/hooks/          agent hooks
```

Add new replacements to `src/replacements.ts` and a matching assertion to `tests/engine.test.ts`.
