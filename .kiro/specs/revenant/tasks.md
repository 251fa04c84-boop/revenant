# Implementation plan

- [x] 1. Scaffold Vite + TypeScript + Vitest project, MIT license, .gitignore that keeps /.kiro (Req 4)
- [x] 2. Manifest parsing: sections, dedupe, aliases, non-registry skips, errors (Req 1.1–1.5)
  - [x] 2.1 GitHub URL and sub-folder parsing, raw URL builder (Req 1.6)
- [x] 3. Registry client: packument extraction, timeouts, bounded concurrency, best-effort downloads (Req 2, 4.1)
  - [x] 3.1 Retry npm rate-limit and transient gateway responses with Retry-After support and a strict retry cap
- [x] 4. Classifier: deprecation, age ladder, finished-vs-dead, legacy, majors behind, score and sorting (Req 2)
- [x] 5. Replacement knowledge base with reasons, effort, notes and diffs (Req 3.1)
- [x] 6. Plan generator: dev/prod aware commands, peer-safe, Markdown export (Req 3.2, 3.3)
- [x] 7. Headstone UI: tabs, filters, disclosure, copy and download (Req 3, 4.2, 4.3)
- [x] 8. Unit tests for parsing, registry helpers, classification, plan output
- [x] 9. Resurrect feature: resurrect() in plan.ts, UI button and panel, trivial-only swap rule (Req 5)
- [x] 10. Deterministic property-style invariant tests: score bounds, count conservation, sorting permutation, resurrection idempotence and preservation of unrelated dependencies
- [ ] 11. Deploy to a static host and verify a live scan of a real repo
- [ ] 12. Record demo video and publish blog post
