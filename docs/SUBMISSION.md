# Kiroween 2026 submission kit (Revenant)

Deadline: **Fri Dec 4, 2026, 2:00 PM PT = Sat Dec 5, 03:30 AM IST.** No extensions. Aim to submit by Dec 3.

## Checklist
- [ ] Kiro user ID or AWS account ID ready; Devpost account created; registered for Kiroween 2026
- [ ] Request the 4,000 free Kiro credits (Resources tab, before Dec 1, 12:00 PM PT)
- [ ] Project is **new and started on/after Oct 30, 2026**. Make the first commit date honest.
- [ ] Open the project in Kiro and do real work there (see `docs/KIRO.md`)
- [ ] Public **GitHub** repo (not GitLab), MIT license present, `/.kiro` committed and **not** in .gitignore
- [ ] Live URL deployed and kept online until judging ends (Jan 29, 2027). No login needed.
- [ ] Demo video under 3 minutes, showing the app working
- [ ] Category selected: **Resurrection**
- [ ] Optional bonuses: social post URL, blog post URL mentioning it is for Kiroween 2026

## Deploy (5 minutes)
1. Create a public GitHub repo, push this folder to `main`.
2. Repo Settings, Pages, Source: **GitHub Actions**. The included workflow tests, builds and publishes.
3. Open the Pages URL and scan the example plus a real repo to confirm.

## Devpost text (edit the Kiro section to match what you really did)

**Tagline:** Paste a package.json. Find the dependencies nobody maintains. Raise them.

**Inspiration:** Every old project has a lockfile full of ghosts: packages deprecated years ago that still sit in production. Finding them means reading npm pages one by one. Resurrection fits: Revenant brings abandoned software back to life by showing exactly how to move on from it.

**What it does:** Revenant scans a package.json or a public GitHub repo, checks every dependency against the npm registry, and gives each a verdict (alive, fading, restless, dead) with plain reasons. For flagged packages it shows replacements, effort, migration notes and a code diff, plus copy-paste npm commands and a Markdown plan.

**How we built it:** TypeScript, Vite and Vitest, no framework and no backend. Pure logic (parsing, classification, plan generation) is unit tested. It runs fully in the browser, so the manifest never leaves the page. It separates abandoned from merely finished packages using download evidence.

**How we used Kiro:** *(Write what is true. Example structure: specs for requirements and design, steering files for product and tech rules, an agent hook that runs tests, and which features you generated or changed with Kiro.)*

**Challenges:** Deciding what counts as dead. Age alone is misleading (tiny stable utilities), so the classifier combines deprecation, release age, downloads and maintainer statements.

**Accomplishments:** Honest verdicts with reasons; works on real repos; headstone UI.

**What we learned:** Registry metadata is enough to be useful; trust comes from explaining every verdict.

**What's next:** More replacements, lockfile support (transitive dependencies), a GitHub Action that posts the plan as an issue.

## Demo video script (about 2:30)
1. (0:00) Title on screen: "Every project has ghosts." Show a real old package.json.
2. (0:15) Paste it, click **Scan**. Narrate: "Revenant asks npm about every package."
3. (0:35) Graveyard appears. Point at score, tally and the dead stones.
4. (0:55) Open **request** and **moment**: show reasons, replacement, effort, diff.
5. (1:25) Show **Raise them all** commands and copy the Markdown plan into a GitHub issue.
6. (1:50) Switch to **GitHub repo** tab, scan a real public repo.
7. (2:10) Show the `/.kiro` folder in the repo and say in one sentence how Kiro was used.
8. (2:25) Close on the live URL.

## Blog post outline (bonus prize; must say it is part of Kiroween 2026)
Title: "How I built Revenant, a dead-dependency finder, for Kiroween 2026". Sections: the problem, how verdicts work (with the finished-vs-dead idea), the knowledge base, using Kiro specs and hooks, what is next.
