import { findReplacement } from './replacements';
import type { Dep, Finding, RegistryInfo, Summary, Verdict } from './types';

const MONTH_MS = 30.4375 * 24 * 3600 * 1000;

export function monthsBetween(iso: string, now: Date): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now.getTime() - t) / MONTH_MS);
}

/** Thresholds in months since the latest release. */
export const THRESHOLDS = { fading: 18, restless: 30, dead: 48 } as const;
/** Packages this widely used are treated as "finished" rather than abandoned. */
const FINISHED_DOWNLOADS = 1_000_000;
const TINY_DOWNLOADS = 100_000;

/** First major version mentioned in a range, or undefined for `*`, `latest`, tags, etc. */
export function rangeMajor(range: string): number | undefined {
  const m = /(\d+)(?:\.|\b)/.exec(range);
  return m && m[1] ? Number.parseInt(m[1], 10) : undefined;
}

export function majorOf(version: string | undefined): number | undefined {
  if (!version) return undefined;
  const m = /^v?(\d+)\./.exec(version);
  return m && m[1] ? Number.parseInt(m[1], 10) : undefined;
}

export function humanAge(months: number): string {
  if (months < 1) return 'less than a month';
  if (months < 24) return `${Math.round(months)} month${Math.round(months) === 1 ? '' : 's'}`;
  const years = months / 12;
  return `${years.toFixed(years >= 10 ? 0 : 1).replace(/\.0$/, '')} years`;
}

function ageVerdict(months: number, downloads: number | undefined): Verdict {
  if (months < THRESHOLDS.fading) return 'alive';
  if (months < THRESHOLDS.restless) return 'fading';
  const finished = downloads !== undefined && downloads >= FINISHED_DOWNLOADS;
  if (finished) return 'fading';
  if (months >= THRESHOLDS.dead && downloads !== undefined && downloads < TINY_DOWNLOADS) return 'dead';
  return 'restless';
}

const WORSE: Record<Verdict, number> = { unknown: -1, alive: 0, fading: 1, restless: 2, dead: 3 };
const worst = (a: Verdict, b: Verdict): Verdict => (WORSE[a] >= WORSE[b] ? a : b);

export function classify(dep: Dep, info: RegistryInfo, now: Date = new Date()): Finding {
  const links = [`https://www.npmjs.com/package/${dep.name}`];
  const replacement = findReplacement(dep.name);
  const reasons: string[] = [];

  if (info.error === 'not-found') {
    return { dep, info, verdict: 'unknown', reasons: ['Not found on the npm registry (private package or typo?).'], links: [] };
  }
  if (info.error) {
    return { dep, info, verdict: 'unknown', reasons: ['Could not reach the npm registry for this package.'], links };
  }

  let verdict: Verdict = 'alive';
  const ageMonths = info.lastPublish ? monthsBetween(info.lastPublish, now) : undefined;

  if (info.deprecated) {
    verdict = 'dead';
    reasons.push(`Deprecated on npm: "${trim(info.deprecated, 160)}"`);
  }

  if (ageMonths !== undefined) {
    const v = ageVerdict(ageMonths, info.weeklyDownloads);
    verdict = worst(verdict, v);
    if (v !== 'alive') {
      const quiet = `No release in ${humanAge(ageMonths)} (latest ${info.latest}).`;
      const finished = info.weeklyDownloads !== undefined && info.weeklyDownloads >= FINISHED_DOWNLOADS;
      // Deprecated packages never get a downloads lookup, so "unavailable" would be misleading for them.
      const noData = info.weeklyDownloads === undefined && v !== 'fading' && !info.deprecated;
      reasons.push(
        finished
          ? `${quiet} Still very widely used, so it may simply be finished.`
          : noData
            ? `${quiet} Download counts were unavailable, so it may simply be finished.`
            : quiet,
      );
    }
  }

  if (replacement?.legacy && verdict !== 'dead') {
    verdict = worst(verdict, 'restless');
    reasons.push(`Its maintainers consider it legacy: ${replacement.why}`);
  } else if (replacement && !info.deprecated && verdict !== 'alive') {
    reasons.push(replacement.why);
  }

  const dm = rangeMajor(dep.range);
  const lm = majorOf(info.latest);
  let majorsBehind: number | undefined;
  if (dm !== undefined && lm !== undefined && lm > dm) {
    majorsBehind = lm - dm;
    if (majorsBehind >= 2) reasons.push(`You are ${majorsBehind} major versions behind (range ${dep.range}, latest ${info.latest}).`);
  }

  if (verdict === 'alive' && reasons.length === 0) reasons.push('Recently published and not deprecated.');
  return { dep, info, verdict, ageMonths, majorsBehind, reasons, replacement, links };
}

const WEIGHT: Record<Verdict, number> = { alive: 0, fading: 0.25, restless: 0.5, dead: 1, unknown: 0 };

export function summarize(findings: readonly Finding[]): Summary {
  const counts: Record<Verdict, number> = { alive: 0, fading: 0, restless: 0, dead: 0, unknown: 0 };
  let weight = 0;
  for (const f of findings) {
    counts[f.verdict]++;
    weight += WEIGHT[f.verdict];
  }
  const known = findings.length - counts.unknown;
  if (known === 0) return { score: 0, label: 'Empty', counts, total: findings.length };
  const score = Math.round(100 * (1 - weight / known));
  const label = score >= 85 ? 'Living' : score >= 65 ? 'Uneasy' : score >= 40 ? 'Haunted' : 'Cursed';
  return { score, label, counts, total: findings.length };
}

export const ORDER: Verdict[] = ['dead', 'restless', 'fading', 'unknown', 'alive'];

/** Worst first, then oldest first within a verdict. */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  const rank = (v: Verdict) => ORDER.indexOf(v);
  return [...findings].sort(
    (a, b) =>
      rank(a.verdict) - rank(b.verdict) ||
      (b.ageMonths ?? 0) - (a.ageMonths ?? 0) ||
      a.dep.name.localeCompare(b.dep.name),
  );
}

function trim(s: string, max: number): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}
