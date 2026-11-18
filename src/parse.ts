import type { Dep, DepKind, ParsedManifest } from './types';

/** Priority order: when a package is listed in several sections we keep the most "production" one. */
const KINDS: DepKind[] = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'devDependencies',
];

const NON_REGISTRY = /^(?:workspace:|file:|link:|portal:|patch:|git\+|git:|github:|gitlab:|bitbucket:|https?:|\.{0,2}\/|~\/)/i;
const VALID_NAME = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/i;
const NPM_ALIAS = /^npm:(@?[^@]+)(?:@(.+))?$/;

export function parsePackageJson(text: string): ParsedManifest {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That is not valid JSON. Paste the full contents of a package.json file.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Expected a package.json object at the top level.');
  }
  const obj = data as Record<string, unknown>;
  const seen = new Set<string>();
  const deps: Dep[] = [];
  const skipped: ParsedManifest['skipped'] = [];

  for (const kind of KINDS) {
    const section = obj[kind];
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
    for (const [rawName, rawRange] of Object.entries(section as Record<string, unknown>)) {
      const range = typeof rawRange === 'string' ? rawRange : String(rawRange);
      let name = rawName;
      let finalRange = range;

      const alias = NPM_ALIAS.exec(range);
      if (alias && alias[1]) {
        name = alias[1];
        finalRange = alias[2] ?? 'latest';
      } else if (NON_REGISTRY.test(range) || (range.includes('/') && !range.includes(' '))) {
        skipped.push({ name: rawName, range, reason: 'Not installed from the npm registry' });
        continue;
      }
      if (!VALID_NAME.test(name)) {
        skipped.push({ name: rawName, range, reason: 'Not a valid npm package name' });
        continue;
      }
      if (seen.has(name)) continue;
      seen.add(name);
      deps.push({ name, range: finalRange, kind });
    }
  }

  return {
    name: typeof obj.name === 'string' ? obj.name : undefined,
    deps,
    skipped,
  };
}

export interface RepoRef {
  owner: string;
  repo: string;
  branch?: string;
  dir?: string;
}

/** Accepts `owner/repo`, a github.com URL, or a tree/blob URL pointing at a sub-folder. */
export function parseRepoRef(input: string): RepoRef | null {
  const text = input.trim().replace(/\.git$/, '');
  if (!text) return null;
  const short = /^([\w.-]+)\/([\w.-]+)$/.exec(text);
  if (short && short[1] && short[2]) return { owner: short[1], repo: short[2] };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const [owner, repo, mode, branch, ...rest] = parts;
  if (!owner || !repo) return null;
  const ref: RepoRef = { owner, repo: repo.replace(/\.git$/, '') };
  if ((mode === 'tree' || mode === 'blob') && branch) {
    ref.branch = branch; // limitation: branch names containing "/" are not supported
    if (mode === 'blob' && rest.at(-1) === 'package.json') rest.pop();
    if (rest.length) ref.dir = rest.join('/');
  }
  return ref;
}

export function rawManifestUrl(ref: RepoRef): string {
  const dir = ref.dir ? `${ref.dir}/` : '';
  return `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${ref.branch ?? 'HEAD'}/${dir}package.json`;
}
