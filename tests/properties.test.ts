import { describe, expect, it } from 'vitest';
import { classify, sortFindings, summarize } from '../src/classify';
import { resurrect } from '../src/plan';
import type { Dep, Finding, RegistryInfo } from '../src/types';

const NOW = new Date('2026-11-18T00:00:00.000Z');
const monthsAgo = (months: number) => new Date(NOW.getTime() - months * 30.4375 * 86_400_000).toISOString();

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function syntheticFindings(seed: number): Finding[] {
  const random = seeded(seed);
  const count = Math.floor(random() * 40);
  return Array.from({ length: count }, (_, i) => {
    const dep: Dep = { name: `property-package-${seed}-${i}`, range: '^1.0.0', kind: 'dependencies' };
    const months = Math.floor(random() * 90);
    const downloads = random() < 0.5 ? undefined : Math.floor(random() * 2_000_000);
    const info: RegistryInfo = {
      name: dep.name,
      latest: '1.0.0',
      lastPublish: monthsAgo(months),
      ...(downloads === undefined ? {} : { weeklyDownloads: downloads }),
    };
    return classify(dep, info, NOW);
  });
}

describe('deterministic property checks', () => {
  it('keeps every generated health score in range and counts conserved', () => {
    for (let seed = 0; seed < 256; seed++) {
      const findings = syntheticFindings(seed);
      const summary = summarize(findings);
      const total = Object.values(summary.counts).reduce((sum, value) => sum + value, 0);

      expect(summary.score, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(summary.score, `seed ${seed}`).toBeLessThanOrEqual(100);
      expect(total, `seed ${seed}`).toBe(findings.length);
      expect(summary.total, `seed ${seed}`).toBe(findings.length);
    }
  });

  it('sorts every generated result without losing or duplicating a finding', () => {
    for (let seed = 0; seed < 256; seed++) {
      const findings = syntheticFindings(seed);
      const sorted = sortFindings(findings);
      expect(sorted.map((f) => f.dep.name).sort(), `seed ${seed}`).toEqual(
        findings.map((f) => f.dep.name).sort(),
      );
      expect(new Set(sorted.map((f) => f.dep.name)).size, `seed ${seed}`).toBe(findings.length);
    }
  });

  it('keeps resurrection idempotent and preserves unrelated dependencies', () => {
    const candidates = [
      { name: 'node-sass', kind: 'devDependencies' as const, range: '^7.0.0', deprecated: 'deprecated' },
      { name: 'node-uuid', kind: 'dependencies' as const, range: '^1.4.8', deprecated: 'deprecated' },
      { name: 'request', kind: 'dependencies' as const, range: '^2.88.0', deprecated: 'deprecated' },
      { name: 'moment', kind: 'peerDependencies' as const, range: '>=2', deprecated: undefined },
    ];

    for (let seed = 0; seed < 128; seed++) {
      const random = seeded(seed + 700);
      const selected = candidates.filter(() => random() > 0.35);
      const manifest = {
        name: `property-demo-${seed}`,
        dependencies: {
          'node-uuid': '^1.4.8',
          request: '^2.88.0',
          'untouched-prod': '^9.1.0',
        },
        devDependencies: { 'node-sass': '^7.0.0', 'untouched-dev': '~3.2.1' },
        peerDependencies: { moment: '>=2' },
        scripts: { build: 'tsc && vite build' },
      };
      const findings = selected.map((item) => {
        const dep: Dep = { name: item.name, range: item.range, kind: item.kind };
        const info: RegistryInfo = {
          name: item.name,
          latest: item.name === 'node-sass' ? '9.0.0' : item.name === 'node-uuid' ? '1.4.8' : '2.88.2',
          lastPublish: monthsAgo(item.name === 'moment' ? 2 : 70),
          ...(item.deprecated ? { deprecated: item.deprecated } : {}),
        };
        return classify(dep, info, NOW);
      });
      const original = JSON.stringify(manifest, null, 2) + '\n';
      const versions = { sass: '1.80.0', uuid: '11.0.0' };
      const once = resurrect(original, findings, versions);
      const twice = resurrect(once.json, findings, versions);
      const after = JSON.parse(once.json) as typeof manifest;

      expect(twice.json, `idempotence seed ${seed}`).toBe(once.json);
      expect(after.dependencies['untouched-prod'], `prod seed ${seed}`).toBe('^9.1.0');
      expect(after.devDependencies['untouched-dev'], `dev seed ${seed}`).toBe('~3.2.1');
      expect(after.scripts, `scripts seed ${seed}`).toEqual(manifest.scripts);
      expect(after.peerDependencies.moment, `peer seed ${seed}`).toBe('>=2');
    }
  });
});
