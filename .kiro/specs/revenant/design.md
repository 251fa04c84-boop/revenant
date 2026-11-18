# Design: Revenant

## Architecture
A static single-page app. All logic runs in the browser.

```
package.json / GitHub URL
        │  parse.ts
        ▼
   Dep[] ──► registry.ts (8 parallel lookups) ──► RegistryInfo[]
                                   │
                                   ▼
                          classify.ts ◄── replacements.ts
                                   │
                    Finding[] + Summary
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
                main.ts (headstones UI)       plan.ts (Markdown + commands)
```

## Key decisions
- **Packument, not full metadata crawl.** One request per package returns latest tag, deprecation text and publish time. Downloads are fetched only for packages 18+ months old that are not already deprecated, which keeps a 100-dependency scan quick.
- **Evidence-based "dead".** Age alone is weak evidence, so download counts separate abandoned packages from finished ones.
- **Curated replacements.** A hand-written knowledge base is more trustworthy than guessing alternatives. Unknown packages get a neutral "search npm or look for a fork" note.
- **Safe rendering.** A tiny `h()` helper builds DOM nodes with `textContent`; no `innerHTML`.
- **Score.** Weights: alive 0, fading 0.25, restless 0.5, dead 1. Score = 100 × (1 − weighted share of known packages). Labels: Living 85+, Uneasy 65+, Haunted 40+, Cursed below.

## UI concept
Each dependency is a headstone: arched top, name, epitaph lines (the reasons) and a "Show resurrection" disclosure that reveals the replacement, effort and a code diff. Colour of the arch encodes the verdict. Palette: mist #d9e0dc, stone #eef1ee, ink #15201d, moss #2b6f62, dead #7b2d4f, restless #9a5b12.

## Error handling
Network failures degrade a single package to "unknown" instead of failing the scan; request timeout is 20 s; GitHub 404s explain what to check.
