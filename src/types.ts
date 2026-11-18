export type DepKind =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies';

export interface Dep {
  /** Real registry name (npm: aliases are resolved to the target package). */
  name: string;
  /** Range exactly as written in package.json. */
  range: string;
  kind: DepKind;
}

export interface ParsedManifest {
  name?: string;
  deps: Dep[];
  /** Entries we deliberately did not look up (workspace:, git, file:, ...). */
  skipped: { name: string; range: string; reason: string }[];
}

export interface RegistryInfo {
  name: string;
  /** dist-tags.latest */
  latest?: string;
  /** Deprecation message on the latest version, if any. */
  deprecated?: string;
  /** ISO publish time of the latest version. */
  lastPublish?: string;
  /** Weekly downloads (best effort, may be missing). */
  weeklyDownloads?: number;
  error?: 'not-found' | 'network';
}

export type Verdict = 'alive' | 'fading' | 'restless' | 'dead' | 'unknown';

export interface Alt {
  /** Human label, e.g. "dayjs" or "native fetch (Node 18+)". */
  label: string;
  /** npm package to install; absent for built-in / native replacements. */
  pkg?: string;
}

export type Effort = 'trivial' | 'moderate' | 'involved';

export interface Replacement {
  from: string[];
  alts: Alt[];
  why: string;
  effort: Effort;
  notes: string;
  /** True if the package is not deprecated on npm but its maintainers call it legacy. */
  legacy?: boolean;
  snippet?: { before: string; after: string };
}

export interface Finding {
  dep: Dep;
  info: RegistryInfo;
  verdict: Verdict;
  ageMonths?: number;
  majorsBehind?: number;
  /** Short, human-readable epitaph lines. */
  reasons: string[];
  replacement?: Replacement;
  links: string[];
}

export interface Summary {
  score: number;
  label: 'Living' | 'Uneasy' | 'Haunted' | 'Cursed' | 'Empty';
  counts: Record<Verdict, number>;
  total: number;
}
