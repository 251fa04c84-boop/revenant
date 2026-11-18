import './style.css';
import { EXAMPLE_MANIFEST } from './example';
import { classify, humanAge, sortFindings, summarize } from './classify';
import { buildMarkdown, migrationCommands } from './plan';
import { parsePackageJson, parseRepoRef, rawManifestUrl } from './parse';
import { lookup, mapPool } from './registry';
import type { Finding, ParsedManifest, Verdict } from './types';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

/** Tiny DOM builder. All text goes through textContent, so registry data can never inject markup. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...kids: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const kid of kids) if (kid) el.append(kid);
  return el;
}

const VERDICT_COPY: Record<Verdict, { word: string; line: string }> = {
  dead: { word: 'Dead', line: 'Beyond saving. Replace it.' },
  restless: { word: 'Restless', line: 'Still moving, but not for long.' },
  fading: { word: 'Fading', line: 'Quiet lately. Keep an eye on it.' },
  alive: { word: 'Alive', line: 'Healthy.' },
  unknown: { word: 'Unknown', line: 'Could not be checked.' },
};

const state = { findings: [] as Finding[], manifest: null as ParsedManifest | null, filter: 'all' as 'all' | Verdict };

const manifestEl = $<HTMLTextAreaElement>('manifest');
const repoEl = $<HTMLInputElement>('repo');
const scanBtn = $<HTMLButtonElement>('scan');
const statusEl = $('status');
const resultsEl = $('results');

/* ---------- tabs ---------- */
const tabs = [$('tab-paste'), $('tab-repo')];
const panels = [$('panel-paste'), $('panel-repo')];
let mode: 'paste' | 'repo' = 'paste';
function selectTab(i: number): void {
  mode = i === 0 ? 'paste' : 'repo';
  tabs.forEach((t, j) => {
    t.setAttribute('aria-selected', String(i === j));
    t.tabIndex = i === j ? 0 : -1;
  });
  panels.forEach((p, j) => (p.hidden = i !== j));
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(i));
  t.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const next = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      selectTab(next);
      tabs[next]?.focus();
    }
  });
});

$('example').addEventListener('click', () => {
  selectTab(0);
  manifestEl.value = EXAMPLE_MANIFEST;
  void scan();
});
scanBtn.addEventListener('click', () => void scan());
repoEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void scan();
});

/* ---------- scanning ---------- */
function setStatus(msg: string, isError = false): void {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', isError);
}

async function loadManifestText(): Promise<string> {
  if (mode === 'paste') {
    const text = manifestEl.value.trim();
    if (!text) throw new Error('Paste a package.json first, or load the example.');
    return text;
  }
  const ref = parseRepoRef(repoEl.value);
  if (!ref) throw new Error('Enter a GitHub repository like owner/repo or a github.com link.');
  const res = await fetch(rawManifestUrl(ref));
  if (res.status === 404) {
    throw new Error('No package.json found there. Check the name, make sure the repo is public, or link to the sub-folder that holds it.');
  }
  if (!res.ok) throw new Error(`GitHub returned an error (${res.status}). Try again in a moment.`);
  return res.text();
}

let running = false;
async function scan(): Promise<void> {
  if (running) return;
  running = true;
  scanBtn.disabled = true;
  resultsEl.hidden = true;
  try {
    setStatus(mode === 'repo' ? 'Fetching package.json…' : 'Reading package.json…');
    const manifest = parsePackageJson(await loadManifestText());
    if (manifest.deps.length === 0) throw new Error('This package.json has no dependencies to check.');
    state.manifest = manifest;
    const now = new Date();
    const infos = await mapPool(
      manifest.deps,
      8,
      (d) => lookup(d, fetch, now),
      (done, total) => setStatus(`Checking the registry: ${done} of ${total}`),
    );
    state.findings = sortFindings(manifest.deps.map((d, i) => classify(d, infos[i]!, now)));
    state.filter = 'all';
    const failed = state.findings.filter((f) => f.info.error === 'network').length;
    setStatus(failed ? `Done. ${failed} package${failed === 1 ? '' : 's'} could not be reached, so they are marked unknown.` : '');
    render();
    resultsEl.hidden = false;
    resultsEl.focus({ preventScroll: true });
    resultsEl.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Something went wrong.', true);
  } finally {
    running = false;
    scanBtn.disabled = false;
  }
}

/* ---------- rendering ---------- */
function render(): void {
  const summary = summarize(state.findings);
  const m = state.manifest;
  const md = buildMarkdown(state.findings, summary, { manifestName: m?.name });
  const cmds = migrationCommands(state.findings);

  const verdictLine = h('p', { class: 'score-line' }, h('strong', {}, `${summary.label}`), ` · health ${summary.score} of 100`);
  const tally = h('ul', { class: 'tally', 'aria-label': 'Counts by verdict' });
  for (const v of ['dead', 'restless', 'fading', 'alive', 'unknown'] as Verdict[]) {
    if (summary.counts[v] === 0) continue;
    tally.append(h('li', { class: `tally-${v}` }, h('b', {}, String(summary.counts[v])), ` ${VERDICT_COPY[v].word.toLowerCase()}`));
  }

  const copyBtn = h('button', { type: 'button', class: 'primary' }, 'Copy plan as Markdown');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(md);
      copyBtn.textContent = 'Copied';
    } catch {
      copyBtn.textContent = 'Copy failed. Use Download instead.';
    }
    setTimeout(() => (copyBtn.textContent = 'Copy plan as Markdown'), 2000);
  });
  const dlBtn = h('button', { type: 'button', class: 'quiet' }, 'Download plan');
  dlBtn.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    const a = h('a', { href: url, download: 'resurrection-plan.md' });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const head = h(
    'div',
    { class: 'summary' },
    h('h2', {}, m?.name ? `The graveyard of ${m.name}` : 'The graveyard'),
    verdictLine,
    tally,
    h('div', { class: 'actions' }, copyBtn, dlBtn),
  );

  const parts: Node[] = [head];

  if (cmds.length) {
    const pre = h('pre', {}, h('code', {}, cmds.join('\n')));
    parts.push(h('div', { class: 'migration' }, h('h3', {}, 'Raise them all'), h('p', {}, 'Swap every package that has a clear replacement. Review the notes on each stone before you run these.'), pre));
  }

  // filters
  const filters = h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter by verdict' });
  const options: ('all' | Verdict)[] = ['all', 'dead', 'restless', 'fading', 'alive', 'unknown'];
  const grid = h('ol', { class: 'grave-grid', 'aria-live': 'polite' });
  const paint = () => {
    grid.replaceChildren(...state.findings.filter((f) => state.filter === 'all' || f.verdict === state.filter).map(stone));
    for (const b of filters.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === state.filter));
  };
  for (const v of options) {
    if (v !== 'all' && summary.counts[v] === 0) continue;
    const label = v === 'all' ? `All ${summary.total}` : `${VERDICT_COPY[v].word} ${summary.counts[v]}`;
    const b = h('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === 'all') }, label);
    b.addEventListener('click', () => {
      state.filter = v;
      paint();
    });
    filters.append(b);
  }
  parts.push(filters, grid);
  paint();

  if (m && m.skipped.length) {
    const list = h('ul', {});
    for (const s of m.skipped) list.append(h('li', {}, h('code', {}, `${s.name}@${s.range}`), ` ${s.reason.toLowerCase()}.`));
    parts.push(h('details', { class: 'skipped' }, h('summary', {}, `${m.skipped.length} not checked`), list));
  }
  resultsEl.replaceChildren(...parts);
}

function stone(f: Finding): HTMLElement {
  const v = f.verdict;
  const born = f.info.lastPublish ? new Date(f.info.lastPublish).getFullYear() : undefined;
  const meta = [f.dep.range, f.dep.kind === 'dependencies' ? null : f.dep.kind.replace('Dependencies', ' dep'), f.ageMonths !== undefined ? `last release ${humanAge(f.ageMonths)} ago` : null]
    .filter(Boolean)
    .join(' · ');

  const body = h('div', { class: 'epitaph' });
  body.append(h('p', { class: 'rip' }, `${VERDICT_COPY[v].word}${born && v !== 'alive' ? `, last stirred ${born}` : ''}`));
  const reasons = h('ul', {});
  for (const r of f.reasons) reasons.append(h('li', {}, r));
  body.append(reasons);

  const li = h('li', { class: `stone v-${v}` });
  const card = h('article', { 'aria-labelledby': `n-${cssId(f.dep.name)}` });
  const link = f.links[0];
  card.append(
    h('h3', { id: `n-${cssId(f.dep.name)}` }, link ? h('a', { href: link, target: '_blank', rel: 'noopener noreferrer' }, f.dep.name) : f.dep.name),
    h('p', { class: 'meta' }, meta),
    body,
  );

  if (f.replacement && v !== 'alive' && v !== 'unknown') {
    const r = f.replacement;
    const raise = h('div', { class: 'raise' });
    const alts = h('ul', { class: 'alts' });
    for (const a of r.alts) alts.append(h('li', {}, a.pkg ? h('a', { href: `https://www.npmjs.com/package/${a.pkg}`, target: '_blank', rel: 'noopener noreferrer' }, a.label) : a.label));
    raise.append(h('p', { class: 'label' }, 'Replace with'), alts, h('p', { class: 'effort' }, `Effort: ${r.effort}. ${r.notes}`));
    if (r.snippet) {
      raise.append(h('pre', { class: 'diff' }, h('code', {}, ...r.snippet.before.split('\n').map((l) => h('span', { class: 'del' }, `- ${l}\n`)), ...r.snippet.after.split('\n').map((l) => h('span', { class: 'add' }, `+ ${l}\n`)))));
    }
    const d = h('details', { class: 'resurrect' }, h('summary', {}, 'Show resurrection'), raise);
    card.append(d);
  } else if (v === 'dead' || v === 'restless') {
    card.append(h('p', { class: 'no-alt' }, 'No curated replacement. Search npm for an actively maintained alternative or a community fork.'));
  }
  li.append(card);
  return li;
}

const cssId = (s: string) => s.replace(/[^a-z0-9_-]/gi, '_');
