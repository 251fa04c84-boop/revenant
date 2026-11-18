# How Kiro is used in this repo

> **Owner: edit this file to describe what you actually did in Kiro.** Judges can see the `/.kiro` folder and read your write-up, so keep it truthful. Do not claim steps you did not take.

## What is in `/.kiro`
- `specs/revenant/`: requirements (EARS-style acceptance criteria), design, and a task list.
- `steering/`: product, tech and structure context that Kiro loads for every session.
- `hooks/test-on-save.json`: an agent hook that runs the tests whenever verdict logic changes.

## Suggested way to use it for real
1. Open this folder in Kiro and let it index the steering files.
2. Open the spec and ask Kiro to work through the unchecked tasks (9 and 10), or extend the spec with a new requirement such as "export the plan as a GitHub issue" and let Kiro implement it from the spec.
3. Add at least one more replacement to `src/replacements.ts` through Kiro and let the hook run the tests.
4. Keep your Kiro chat or spec history; mention the specific features you used (specs, steering, hooks, vibe coding) in the Devpost write-up.
