import { describe, expect, it } from 'vitest';
import { parsePackageJson, parseRepoRef, rawManifestUrl } from '../src/parse';
import { classify, majorOf, rangeMajor, sortFindings, summarize } from '../src/classify';
import { extractInfo, mapPool, registryUrl } from '../src/registry';
import { buildMarkdown, migrationCommands, replacementPackages, resurrect } from '../src/plan';
import { ALL_KB_NAMES, findReplacement, KNOWN_REPLACEMENT_COUNT } from '../src/replacements';
import type { Dep, RegistryInfo } from '../src/types';

const NOW = new Date('2026-11-18T00:00:00Z');
const dep = (name: string, range = '^1.0.0', kind: Dep['kind'] = 'dependencies'): Dep => ({ name, range, kind });
const monthsAgo = (m: number) => new Date(NOW.getTime() - m * 30.4375 * 864e5).toISOString();
const info = (o: Partial<RegistryInfo> & { name: string }): RegistryInfo => ({ latest: '1.0.0', ...o });

describe('parsePackageJson', () => {
  it('reads all four sections and dedupes by priority', () => {
    const m = parsePackageJson(
      JSON.stringify({
        name: 'x',
        dependencies: { a: '^1.0.0', b: '2.0.0' },
        devDependencies: { a: '^1.0.0', c: '~3.1.0' },
        peerDependencies: { d: '>=1' },
        optionalDependencies: { e: '1' },
      }),
    );
    expect(m.name).toBe('x');
    expect(m.deps.map((d) => d.name).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(m.deps.find((d) => d.name === 'a')?.kind).toBe('dependencies');
  });

  it('skips non-registry specifiers and resolves npm aliases', () => {
    const m = parsePackageJson(
      JSON.stringify({
        dependencies: {
          local: 'file:../local',
          ws: 'workspace:*',
          gh: 'github:owner/repo',
          short: 'owner/repo',
          tarball: 'https://example.com/x.tgz',
          alias: 'npm:left-pad@^1.3.0',
          scoped: '^1.0.0',
        },
      }),
    );
    expect(m.skipped.map((s) => s.name).sort()).toEqual(['gh', 'local', 'short', 'tarball', 'ws']);
    expect(m.deps.find((d) => d.name === 'left-pad')?.range).toBe('^1.3.0');
    expect(m.deps.some((d) => d.name === 'alias')).toBe(false);
  });

  it('rejects invalid names and bad JSON', () => {
    expect(parsePackageJson(JSON.stringify({ dependencies: { 'Bad Name!': '1.0.0' } })).skipped).toHaveLength(1);
    expect(() => parsePackageJson('{nope')).toThrow(/valid JSON/);
    expect(() => parsePackageJson('[]')).toThrow(/object/);
  });
});

describe('parseRepoRef / rawManifestUrl', () => {
  it('handles shorthand, full URLs and sub-folders', () => {
    expect(parseRepoRef('expressjs/express')).toEqual({ owner: 'expressjs', repo: 'express' });
    expect(parseRepoRef('https://github.com/a/b.git')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseRepoRef('https://github.com/a/b/tree/main/packages/x')).toEqual({
      owner: 'a', repo: 'b', branch: 'main', dir: 'packages/x',
    });
    expect(parseRepoRef('https://github.com/a/b/blob/dev/app/package.json')).toEqual({
      owner: 'a', repo: 'b', branch: 'dev', dir: 'app',
    });
    expect(parseRepoRef('https://gitlab.com/a/b')).toBeNull();
    expect(parseRepoRef('')).toBeNull();
  });

  it('builds raw URLs', () => {
    expect(rawManifestUrl({ owner: 'a', repo: 'b' })).toBe('https://raw.githubusercontent.com/a/b/HEAD/package.json');
    expect(rawManifestUrl({ owner: 'a', repo: 'b', branch: 'main', dir: 'x/y' })).toBe(
      'https://raw.githubusercontent.com/a/b/main/x/y/package.json',
    );
  });
});

describe('registry helpers', () => {
  it('encodes scoped names correctly', () => {
    expect(registryUrl('@babel/core')).toBe('https://registry.npmjs.org/@babel%2Fcore');
    expect(registryUrl('left-pad')).toBe('https://registry.npmjs.org/left-pad');
  });

  it('extracts latest, deprecation and publish time', () => {
    const i = extractInfo('p', {
      'dist-tags': { latest: '2.0.0' },
      versions: { '2.0.0': { deprecated: ' use other ' } },
      time: { created: 'x', modified: 'y', '2.0.0': '2020-01-01T00:00:00Z' },
    });
    expect(i).toMatchObject({ latest: '2.0.0', deprecated: 'use other', lastPublish: '2020-01-01T00:00:00Z' });
  });

  it('falls back when latest tag is missing and flags unpublished', () => {
    const i = extractInfo('p', { time: { created: 'a', modified: 'b', '1.0.0': '2019-01-01T00:00:00Z', '1.1.0': '2021-01-01T00:00:00Z' } });
    expect(i.latest).toBe('1.1.0');
    expect(extractInfo('p', { time: { unpublished: { time: 'x' } } }).deprecated).toMatch(/unpublished/);
    expect(extractInfo('p', {}).error).toBe('not-found');
  });

  it('mapPool preserves order and bounds concurrency', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('versions', () => {
  it('reads majors', () => {
    expect(rangeMajor('^2.3.4')).toBe(2);
    expect(rangeMajor('>=10 <12')).toBe(10);
    expect(rangeMajor('latest')).toBeUndefined();
    expect(majorOf('v5.0.1')).toBe(5);
    expect(majorOf(undefined)).toBeUndefined();
  });
});

describe('classify', () => {
  it('marks deprecated packages dead', () => {
    const f = classify(dep('request', '^2.88.0'), info({ name: 'request', latest: '2.88.2', deprecated: 'deprecated', lastPublish: monthsAgo(70) }), NOW);
    expect(f.verdict).toBe('dead');
    expect(f.replacement?.alts[0]?.label).toMatch(/fetch/);
    expect(f.reasons[0]).toMatch(/Deprecated on npm/);
  });

  it('fresh packages are alive', () => {
    const f = classify(dep('x'), info({ name: 'x', lastPublish: monthsAgo(2) }), NOW);
    expect(f.verdict).toBe('alive');
  });

  it('age ladder: fading, restless, dead', () => {
    expect(classify(dep('x'), info({ name: 'x', lastPublish: monthsAgo(20) }), NOW).verdict).toBe('fading');
    expect(classify(dep('x'), info({ name: 'x', lastPublish: monthsAgo(36) }), NOW).verdict).toBe('restless');
    expect(classify(dep('x'), info({ name: 'x', lastPublish: monthsAgo(60), weeklyDownloads: 50 }), NOW).verdict).toBe('dead');
    // Old but with unknown downloads: do not call it dead without evidence.
    expect(classify(dep('x'), info({ name: 'x', lastPublish: monthsAgo(60) }), NOW).verdict).toBe('restless');
  });

  it('treats very widely used old packages as finished, not dead', () => {
    const f = classify(dep('x'), info({ name: 'x', lastPublish: monthsAgo(80), weeklyDownloads: 30_000_000 }), NOW);
    expect(f.verdict).toBe('fading');
    expect(f.reasons.join(' ')).toMatch(/finished/);
  });

  it('flags legacy packages like moment as restless even when recently published', () => {
    const f = classify(dep('moment', '^2.29.0'), info({ name: 'moment', latest: '2.31.0', lastPublish: monthsAgo(2) }), NOW);
    expect(f.verdict).toBe('restless');
    expect(f.replacement?.alts.some((a) => a.pkg === 'dayjs')).toBe(true);
  });

  it('reports majors behind only when 2+', () => {
    const behind = classify(dep('x', '^1.0.0'), info({ name: 'x', latest: '4.2.0', lastPublish: monthsAgo(1) }), NOW);
    expect(behind.majorsBehind).toBe(3);
    expect(behind.reasons.join(' ')).toMatch(/3 major versions behind/);
    const one = classify(dep('x', '^3.0.0'), info({ name: 'x', latest: '4.2.0', lastPublish: monthsAgo(1) }), NOW);
    expect(one.reasons.join(' ')).not.toMatch(/major versions behind/);
  });

  it('handles registry errors', () => {
    expect(classify(dep('x'), { name: 'x', error: 'not-found' }, NOW).verdict).toBe('unknown');
    expect(classify(dep('x'), { name: 'x', error: 'network' }, NOW).verdict).toBe('unknown');
  });
});

describe('summary, sorting and plan', () => {
  const findings = [
    classify(dep('fresh'), info({ name: 'fresh', lastPublish: monthsAgo(1) }), NOW),
    classify(dep('request', '^2.88.0'), info({ name: 'request', latest: '2.88.2', deprecated: 'x', lastPublish: monthsAgo(70) }), NOW),
    classify(dep('moment', '^2.29.0'), info({ name: 'moment', latest: '2.31.0', lastPublish: monthsAgo(2) }), NOW),
    classify(dep('sass-dev', '^1.0.0', 'devDependencies'), info({ name: 'sass-dev', lastPublish: monthsAgo(20) }), NOW),
    classify(dep('ghost'), { name: 'ghost', error: 'not-found' }, NOW),
  ];

  it('scores and ignores unknown packages', () => {
    const s = summarize(findings);
    expect(s.counts).toMatchObject({ alive: 1, dead: 1, restless: 1, fading: 1, unknown: 1 });
    expect(s.score).toBe(Math.round(100 * (1 - (1 + 0.5 + 0.25) / 4)));
    expect(summarize([]).label).toBe('Empty');
    expect(summarize([findings[0]!]).label).toBe('Living');
  });

  it('sorts worst first', () => {
    expect(sortFindings(findings).map((f) => f.dep.name)).toEqual(['request', 'moment', 'sass-dev', 'ghost', 'fresh']);
  });

  it('generates migration commands, respecting dev vs prod', () => {
    const f = [
      classify(dep('request', '^2.88.0'), info({ name: 'request', latest: '2.88.2', deprecated: 'x', lastPublish: monthsAgo(70) }), NOW),
      classify(dep('node-sass', '^7.0.0', 'devDependencies'), info({ name: 'node-sass', latest: '9.0.0', deprecated: 'x', lastPublish: monthsAgo(30) }), NOW),
      classify(dep('moment', '^2.29.0', 'peerDependencies'), info({ name: 'moment', latest: '2.31.0', lastPublish: monthsAgo(2) }), NOW),
    ];
    const cmds = migrationCommands(f);
    expect(cmds[0]).toBe('npm uninstall node-sass');
    expect(cmds).toContain('npm install -D sass');
    // `request` needs code changes (native fetch), so it is never uninstalled by the quick commands.
    expect(cmds.join('\n')).not.toMatch(/request|undici/);
    // Peer dependencies are never uninstalled.
    expect(cmds[0]).not.toMatch(/moment/);
  });

  it('renders markdown', () => {
    const md = buildMarkdown(findings, summarize(findings), { manifestName: 'demo', now: NOW });
    expect(md).toContain('# Resurrection plan for demo');
    expect(md).toContain('### request (dead)');
    expect(md).toContain('```diff');
    expect(md).toContain('2026-11-18');
    expect(buildMarkdown([findings[0]!], summarize([findings[0]!]), { now: NOW })).toMatch(/Nothing to resurrect/);
  });
});

describe('knowledge base integrity', () => {
  it('has no duplicate names and every entry has a reason and alternatives', () => {
    for (const n of ['request', 'moment', 'node-sass', 'react-scripts', 'faker']) {
      const r = findReplacement(n);
      expect(r, n).toBeDefined();
      expect(r!.alts.length).toBeGreaterThan(0);
      expect(r!.why.length).toBeGreaterThan(10);
    }
  });
});

describe('knowledge base hygiene', () => {
  it('has no duplicate package names', () => {
    const dupes = ALL_KB_NAMES.filter((n, i) => ALL_KB_NAMES.indexOf(n) !== i);
    expect(dupes).toEqual([]);
    expect(KNOWN_REPLACEMENT_COUNT).toBe(ALL_KB_NAMES.length);
  });

  it('every entry is complete and alternatives are valid npm names', () => {
    const valid = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;
    for (const name of ALL_KB_NAMES) {
      const r = findReplacement(name)!;
      expect(r.why.length, name).toBeGreaterThan(15);
      expect(r.notes.length, name).toBeGreaterThan(10);
      expect(r.alts.length, name).toBeGreaterThan(0);
      for (const a of r.alts) if (a.pkg) expect(a.pkg, `${name} -> ${a.pkg}`).toMatch(valid);
      expect(['trivial', 'moderate', 'involved']).toContain(r.effort);
    }
  });

  it('never suggests a package as its own replacement', () => {
    for (const name of ALL_KB_NAMES) {
      const r = findReplacement(name)!;
      expect(r.alts.some((a) => a.pkg === name), name).toBe(false);
    }
  });
});

describe('missing download data', () => {
  it('says so instead of implying abandonment', () => {
    const f = classify(dep('x'), info({ name: 'x', lastPublish: monthsAgo(40) }), NOW);
    expect(f.verdict).toBe('restless');
    expect(f.reasons.join(' ')).toMatch(/Download counts were unavailable/);
  });
});

describe('deprecated packages and download wording', () => {
  it('does not claim download data was unavailable for deprecated packages', () => {
    const f = classify(dep('request'), info({ name: 'request', latest: '2.88.2', deprecated: 'deprecated', lastPublish: monthsAgo(80) }), NOW);
    expect(f.verdict).toBe('dead');
    expect(f.reasons.join(' ')).not.toMatch(/Download counts were unavailable/);
  });
});

describe('resurrect', () => {
  const manifest = JSON.stringify(
    {
      name: 'demo',
      version: '1.0.0',
      scripts: { build: 'tsc' },
      dependencies: { zebra: '^1.0.0', request: '^2.88.2', 'node-uuid': '^1.4.8' },
      devDependencies: { 'node-sass': '^7.0.3', typescript: '^5.0.0' },
      peerDependencies: { moment: '>=2' },
    },
    null,
    4,
  ) + '\n';
  const f = [
    classify(dep('request', '^2.88.2'), info({ name: 'request', latest: '2.88.2', deprecated: 'x', lastPublish: monthsAgo(70) }), NOW),
    classify(dep('node-uuid', '^1.4.8'), info({ name: 'node-uuid', latest: '1.4.8', deprecated: 'x', lastPublish: monthsAgo(100) }), NOW),
    classify(dep('node-sass', '^7.0.3', 'devDependencies'), info({ name: 'node-sass', latest: '9.0.0', deprecated: 'x', lastPublish: monthsAgo(40) }), NOW),
    classify(dep('moment', '>=2', 'peerDependencies'), info({ name: 'moment', latest: '2.31.0', lastPublish: monthsAgo(2) }), NOW),
    classify(dep('typescript', '^5.0.0', 'devDependencies'), info({ name: 'typescript', lastPublish: monthsAgo(2) }), NOW),
  ];

  it('swaps drop-in replacements in the same section and keeps keys sorted', () => {
    const r = resurrect(manifest, f, { sass: '1.80.0', uuid: '11.0.0' });
    const out = JSON.parse(r.json);
    expect(out.devDependencies).toEqual({ sass: '^1.80.0', typescript: '^5.0.0' });
    expect(Object.keys(out.dependencies)).toEqual(['request', 'uuid', 'zebra']);
    expect(out.dependencies.uuid).toBe('^11.0.0');
    expect(r.swaps.map((s) => `${s.from}>${s.to}`).sort()).toEqual(['node-sass>sass', 'node-uuid>uuid']);
  });

  it('leaves built-in replacements, peers and unrelated fields alone, and reports them', () => {
    const r = resurrect(manifest, f);
    const out = JSON.parse(r.json);
    expect(out.dependencies.request).toBe('^2.88.2');
    expect(out.peerDependencies.moment).toBe('>=2');
    expect(out.scripts).toEqual({ build: 'tsc' });
    expect(out.name).toBe('demo');
    expect(r.pending.map((p) => p.name).sort()).toEqual(['moment', 'request']);
  });

  it('falls back to "latest" without a known version, preserves indent and trailing newline', () => {
    const r = resurrect(manifest, f, {});
    expect(JSON.parse(r.json).devDependencies.sass).toBe('latest');
    expect(r.json.startsWith('{\n    "name"')).toBe(true);
    expect(r.json.endsWith('}\n')).toBe(true);
  });

  it('does not duplicate a replacement that is already installed', () => {
    const m = JSON.stringify({ devDependencies: { 'node-sass': '^7.0.0', sass: '^1.50.0' } });
    const r = resurrect(m, [f[2]!]);
    expect(JSON.parse(r.json).devDependencies).toEqual({ sass: '^1.50.0' });
  });

  it('lists only installable, non-peer replacement packages for version lookup', () => {
    expect(replacementPackages(f).sort()).toEqual(['sass', 'uuid']);
  });

  it('never mutates unrelated dependencies that are not flagged', () => {
    const r = resurrect(manifest, []);
    expect(JSON.parse(r.json)).toEqual(JSON.parse(manifest));
    expect(r.swaps).toHaveLength(0);
  });
});

describe('safety: only near drop-in swaps are automated', () => {
  const popper = classify(dep('popper.js', '^1.16.1'), info({ name: 'popper.js', latest: '1.16.1', deprecated: 'x', lastPublish: monthsAgo(80) }), NOW);
  const react = classify(dep('react-scripts', '^5.0.1', 'devDependencies'), info({ name: 'react-scripts', latest: '5.0.1', lastPublish: monthsAgo(50) }), NOW);
  const m = JSON.stringify({ dependencies: { 'popper.js': '^1.16.1' }, devDependencies: { 'react-scripts': '^5.0.1' } });

  it('does not swap moderate or involved migrations in package.json', () => {
    const r = resurrect(m, [popper, react], { '@popperjs/core': '2.11.8', vite: '8.0.0' });
    expect(JSON.parse(r.json)).toEqual(JSON.parse(m));
    expect(r.swaps).toHaveLength(0);
    expect(r.pending.map((p) => p.name).sort()).toEqual(['popper.js', 'react-scripts']);
  });

  it('does not put them in the quick commands either', () => {
    expect(migrationCommands([popper, react])).toEqual([]);
  });
});

