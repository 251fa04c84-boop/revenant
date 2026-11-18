# Requirements: Revenant

## Introduction
Revenant scans a project's npm dependencies, classifies each as alive, fading, restless or dead, and produces a resurrection plan with replacements.

## Requirements

### 1. Provide a manifest
**User story:** As a developer, I want to paste a package.json or point at a public GitHub repo, so that I can scan my project without installing anything.

1. WHEN the user pastes valid package.json text THEN the system SHALL parse dependencies, devDependencies, peerDependencies and optionalDependencies.
2. WHEN the same package appears in several sections THEN the system SHALL list it once, preferring the production section.
3. WHEN a dependency uses a non-registry specifier (file:, workspace:, git, URL) THEN the system SHALL skip it and list it under "not checked".
4. WHEN a dependency uses an `npm:` alias THEN the system SHALL check the real target package.
5. WHEN the JSON is invalid THEN the system SHALL show an error that says how to fix it.
6. WHEN the user enters `owner/repo` or a github.com URL THEN the system SHALL fetch package.json from that repo or sub-folder, and SHALL explain a 404.

### 2. Classify health
**User story:** As a maintainer, I want an honest verdict per package, so that I can trust what I act on.

1. IF the latest version is deprecated on npm THEN the verdict SHALL be dead.
2. IF there is no release for 18, 30 or 48 months THEN the verdict SHALL be fading, restless or dead respectively.
3. IF a package has at least 1M weekly downloads THEN age alone SHALL NOT raise the verdict above fading.
4. IF a package is 48+ months old and has under 100K weekly downloads THEN the verdict SHALL be dead; IF download data is unavailable THEN it SHALL be restless.
5. IF its maintainers call a package legacy (for example moment) THEN the verdict SHALL be at least restless.
6. WHEN a package is two or more major versions behind THEN the system SHALL say so.
7. Every non-alive verdict SHALL include a plain-language reason.
8. IF the registry cannot be reached for a package THEN it SHALL be marked unknown and excluded from the score.

### 3. Resurrection plan
**User story:** As a developer, I want concrete next steps, so that I can fix the problem today.

1. WHEN a flagged package has a curated replacement THEN the system SHALL show alternatives, effort, migration notes and, where available, a before/after diff.
2. The system SHALL generate npm uninstall and install commands that put replacements in the same dependency section (dev or production) and never uninstall peer dependencies.
3. The system SHALL let the user copy or download the plan as Markdown.

### 4. Privacy and quality
1. The manifest SHALL NOT be sent to any server; only package names go to the npm registry.
2. The UI SHALL work at 390 px width, be keyboard operable, show visible focus and respect reduced motion.
3. Registry text SHALL never be injected as HTML.

### 5. Resurrect the manifest
**User story:** As a developer, I want a ready-to-use package.json with the easy swaps applied, so that I can start migrating right away.

1. WHEN the user clicks "Resurrect my package.json" THEN the system SHALL look up the latest version of each replacement and produce a new package.json.
2. The system SHALL only swap a dependency automatically IF its replacement is an installable package AND the migration effort is "trivial".
3. IF a replacement is built in, needs code changes, is a peer dependency, or is installed through an npm: alias THEN the system SHALL leave the dependency in place and list what the user must do first.
4. The new file SHALL keep every unrelated field, the original indentation and trailing newline, put each replacement in the same section as the original, keep keys sorted, and never add a replacement that is already installed.
5. The "quick swaps" npm commands SHALL follow the same rule as 5.2.

