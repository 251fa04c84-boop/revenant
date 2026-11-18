import type { Alt, Effort, Replacement } from './types';

/**
 * Curated resurrection knowledge base.
 * Every entry is a package that is deprecated on npm, officially end-of-life, renamed,
 * or called "legacy" by its own maintainers. Keep `why` factual and short.
 */

const rename = (
  from: string,
  to: string,
  why: string,
  effort: Effort = 'trivial',
  notes = 'Same project under its new name: swap the dependency and update import paths.',
): Replacement => ({ from: [from], alts: [{ label: to, pkg: to }], why, effort, notes });

const KB: Replacement[] = [
  {
    from: ['request', 'request-promise', 'request-promise-native', 'request-promise-any'],
    alts: [
      { label: 'native fetch (Node 18+ and browsers)' },
      { label: 'undici', pkg: 'undici' },
      { label: 'got', pkg: 'got' },
      { label: 'ky', pkg: 'ky' },
    ],
    why: 'Deprecated by its maintainers in February 2020; no further fixes, including security fixes.',
    effort: 'moderate',
    notes:
      'Callbacks become promises. Check how you use `json: true`, `form`, `qs`, pooling and redirect options, since fetch handles them differently.',
    snippet: {
      before: "request.get({ url, json: true }, (err, res, body) => {\n  /* ... */\n});",
      after: 'const res = await fetch(url);\nconst body = await res.json();',
    },
  },
  {
    from: ['node-sass'],
    alts: [{ label: 'sass (Dart Sass)', pkg: 'sass' }],
    why: 'LibSass and node-sass are deprecated. Dart Sass is the reference implementation.',
    effort: 'trivial',
    notes:
      'Same render API. Watch for the slash-division and `/deep/` deprecations: use `math.div` and `::v-deep` or `:deep()`.',
    snippet: { before: "const sass = require('node-sass');", after: "const sass = require('sass');" },
  },
  {
    from: ['moment', 'moment-timezone'],
    alts: [
      { label: 'dayjs', pkg: 'dayjs' },
      { label: 'date-fns', pkg: 'date-fns' },
      { label: 'luxon', pkg: 'luxon' },
    ],
    why: "Moment's own maintainers call it a legacy project in maintenance mode and advise against starting new work with it.",
    effort: 'moderate',
    legacy: true,
    notes:
      'dayjs keeps a near-identical chainable API (2 KB). For time zones add `dayjs/plugin/utc` and `dayjs/plugin/timezone`. Moment objects are mutable; dayjs and date-fns are not, so check code that mutates dates in place.',
    snippet: {
      before: "moment().add(7, 'days').format('YYYY-MM-DD')",
      after: "dayjs().add(7, 'day').format('YYYY-MM-DD')",
    },
  },
  {
    from: ['tslint'],
    alts: [{ label: 'typescript-eslint', pkg: 'typescript-eslint' }],
    why: 'TSLint was deprecated in 2019 in favour of ESLint with typescript-eslint.',
    effort: 'moderate',
    notes: 'The `tslint-to-eslint-config` tool converts an existing tslint.json automatically.',
  },
  rename('babel-eslint', '@babel/eslint-parser', 'babel-eslint was renamed and is no longer maintained under this name.'),
  {
    from: ['left-pad'],
    alts: [{ label: 'String.prototype.padStart (built in)' }],
    why: 'Deprecated: the language gained `padStart` in ES2017.',
    effort: 'trivial',
    notes: 'Delete the dependency and call the built-in method.',
    snippet: { before: "leftPad(String(n), 3, '0')", after: "String(n).padStart(3, '0')" },
  },
  {
    from: ['gulp-util'],
    alts: [
      { label: 'fancy-log', pkg: 'fancy-log' },
      { label: 'plugin-error', pkg: 'plugin-error' },
    ],
    why: 'Deprecated: gulp-util was split into single-purpose modules.',
    effort: 'moderate',
    notes: 'Map each helper you use: `log` to fancy-log, `PluginError` to plugin-error, `colors` to chalk or picocolors.',
  },
  {
    from: ['querystring'],
    alts: [{ label: 'URLSearchParams (built in)' }],
    why: "Deprecated: the API is legacy and `URLSearchParams` is the standard replacement.",
    effort: 'trivial',
    notes: 'Works in Node and every browser. Remember that URLSearchParams values are strings.',
    snippet: {
      before: 'querystring.stringify({ a: 1, b: 2 })',
      after: "new URLSearchParams({ a: '1', b: '2' }).toString()",
    },
  },
  {
    from: ['node-uuid'],
    alts: [
      { label: 'uuid', pkg: 'uuid' },
      { label: 'crypto.randomUUID() (built in)' },
    ],
    why: 'Deprecated: node-uuid was folded into the `uuid` package.',
    effort: 'trivial',
    notes: "For v4 IDs only, `crypto.randomUUID()` needs no dependency at all.",
    snippet: { before: "require('node-uuid').v4()", after: 'crypto.randomUUID()' },
  },
  rename('coffee-script', 'coffeescript', 'Deprecated: the compiler moved to the `coffeescript` package.'),
  rename('popper.js', '@popperjs/core', 'Deprecated: Popper v1 was replaced by @popperjs/core (v2).', 'moderate',
    'The API changed in v2: modifiers are now an array and the constructor is `createPopper(reference, popper, options)`.'),
  {
    from: ['react-scripts'],
    alts: [
      { label: 'Vite', pkg: 'vite' },
      { label: 'Next.js', pkg: 'next' },
    ],
    why: 'The React team deprecated Create React App in February 2025.',
    effort: 'involved',
    legacy: true,
    notes:
      'Move the build to Vite (SPA) or a framework such as Next.js. Update env var prefixes (REACT_APP_ becomes VITE_) and the entry HTML.',
    snippet: { before: '"start": "react-scripts start"', after: '"dev": "vite"' },
  },
  {
    from: ['enzyme'],
    alts: [{ label: 'React Testing Library', pkg: '@testing-library/react' }],
    why: 'Enzyme has no official adapter for React 18+ and is effectively unmaintained.',
    effort: 'involved',
    legacy: true,
    notes: 'Tests need rewriting from implementation details (`wrapper.state()`) to user-visible behaviour.',
  },
  {
    from: ['protractor'],
    alts: [
      { label: 'Playwright', pkg: '@playwright/test' },
      { label: 'Cypress', pkg: 'cypress' },
    ],
    why: 'Protractor reached end of life in August 2023.',
    effort: 'involved',
    notes: 'Playwright removes the need for Angular-specific waiting helpers.',
  },
  {
    from: ['phantomjs', 'phantomjs-prebuilt'],
    alts: [
      { label: 'Playwright', pkg: 'playwright' },
      { label: 'Puppeteer', pkg: 'puppeteer' },
    ],
    why: 'PhantomJS development was suspended in 2018.',
    effort: 'moderate',
    notes: 'Modern headless Chromium handles current JavaScript, CSS and security standards.',
  },
  {
    from: ['istanbul'],
    alts: [
      { label: 'c8', pkg: 'c8' },
      { label: 'nyc', pkg: 'nyc' },
    ],
    why: 'Deprecated: the original istanbul CLI was superseded by nyc and V8-native coverage tools.',
    effort: 'moderate',
    notes: 'c8 uses V8 built-in coverage and needs no instrumentation.',
  },
  {
    from: ['bower'],
    alts: [
      { label: 'npm', pkg: undefined },
      { label: 'pnpm', pkg: 'pnpm' },
    ],
    why: 'Bower is deprecated and its maintainers recommend moving to npm or Yarn.',
    effort: 'moderate',
    notes: 'Move front-end packages to npm and bundle them with Vite or esbuild.',
  },
  rename('faker', '@faker-js/faker', 'The original faker package was abandoned in 2022; the community maintains @faker-js/faker.', 'moderate',
    'API names changed in newer majors (for example `faker.name.findName()` became `faker.person.fullName()`).'),
  rename('node-pre-gyp', '@mapbox/node-pre-gyp', 'Deprecated: use the maintained @mapbox/node-pre-gyp.'),
  rename('uglify-es', 'terser', 'Deprecated: uglify-es is unmaintained; terser is its maintained successor.'),
  rename('jade', 'pug', 'Deprecated: Jade was renamed to Pug.', 'trivial', 'Rename the package and change `.jade` templates to `.pug`.'),
  {
    from: ['optimist'],
    alts: [
      { label: 'minimist', pkg: 'minimist' },
      { label: 'yargs', pkg: 'yargs' },
      { label: 'util.parseArgs (Node 18.3+)' },
    ],
    why: 'Deprecated: optimist is unmaintained.',
    effort: 'trivial',
    notes: 'minimist is a near drop-in for simple argv parsing.',
  },
  rename('@hapi/joi', 'joi', 'Deprecated: @hapi/joi moved to the unscoped `joi` package.'),
  rename('rollup-plugin-terser', '@rollup/plugin-terser', 'Deprecated: use the official @rollup/plugin-terser.'),
  rename('rollup-plugin-babel', '@rollup/plugin-babel', 'Deprecated: use the official @rollup/plugin-babel.'),
  rename('rollup-plugin-node-resolve', '@rollup/plugin-node-resolve', 'Deprecated: use the official @rollup/plugin-node-resolve.'),
  rename('rollup-plugin-commonjs', '@rollup/plugin-commonjs', 'Deprecated: use the official @rollup/plugin-commonjs.'),
  rename('xmldom', '@xmldom/xmldom', 'Deprecated (security fixes only land in the scoped package).'),
  rename('babel-core', '@babel/core', 'Babel 6 packages are unmaintained; use the @babel/* scope.', 'moderate',
    'Also move presets and plugins to @babel/preset-env and friends, and update .babelrc.'),
  rename('babel-preset-es2015', '@babel/preset-env', 'Babel 6 presets are unmaintained; @babel/preset-env replaces all yearly presets.', 'moderate'),
  {
    from: ['babel-polyfill'],
    alts: [{ label: 'core-js', pkg: 'core-js' }],
    why: 'Deprecated: babel-polyfill was replaced by importing core-js (and regenerator-runtime) directly.',
    effort: 'moderate',
    notes: 'Prefer `useBuiltIns: "usage"` in @babel/preset-env so only needed polyfills are bundled.',
  },
  {
    from: ['inflight'],
    alts: [{ label: 'lru-cache', pkg: 'lru-cache' }],
    why: 'Deprecated: inflight leaks memory and is not supported.',
    effort: 'trivial',
    notes: 'Usually a transitive dependency of old glob versions: upgrade `glob` and the warning disappears.',
  },
  {
    from: ['karma'],
    alts: [
      { label: 'Web Test Runner', pkg: '@web/test-runner' },
      { label: 'Vitest browser mode', pkg: 'vitest' },
    ],
    why: 'Karma was officially deprecated in 2023.',
    effort: 'involved',
    notes: 'Run browser tests with a runner that drives real browsers through Playwright.',
  },
  {
    from: ['crypto'],
    alts: [{ label: 'node:crypto (built in)' }],
    why: 'Deprecated on npm: this placeholder package is no longer supported because crypto is a built-in Node module.',
    effort: 'trivial',
    notes: "Remove the dependency and import from 'node:crypto'. The npm package is not the real module.",
    snippet: { before: "const crypto = require('crypto');", after: "const crypto = require('node:crypto');" },
  },
  {
    from: ['jscs'],
    alts: [{ label: 'ESLint', pkg: 'eslint' }],
    why: 'JSCS merged into ESLint in 2016 and is no longer maintained.',
    effort: 'moderate',
    notes: 'Convert .jscsrc rules to ESLint style rules; the `eslint-config-*` presets cover most JSCS presets.',
  },
  rename('@babel/polyfill', 'core-js', 'Deprecated since Babel 7.4: import core-js and regenerator-runtime directly.', 'moderate',
    'Prefer `useBuiltIns: "usage"` with `corejs: 3` in @babel/preset-env so only needed polyfills ship.'),
  rename('babel-preset-env', '@babel/preset-env', 'Babel 6 presets are unmaintained; @babel/preset-env is the supported version.', 'moderate',
    'Move the rest of your Babel 6 plugins and presets to the @babel/* scope at the same time.'),
  {
    from: ['spectron'],
    alts: [
      { label: 'Playwright', pkg: '@playwright/test' },
      { label: 'WebdriverIO', pkg: 'webdriverio' },
    ],
    why: 'Spectron (Electron testing) was deprecated in February 2022 and does not support current Electron versions.',
    effort: 'involved',
    notes: "Playwright can launch and drive Electron apps through its `_electron` API.",
  },
  {
    from: ['typings'],
    alts: [{ label: '@types packages', pkg: undefined }],
    why: 'Deprecated: type definitions are installed from the @types scope on npm.',
    effort: 'moderate',
    notes: 'Delete typings.json and install `@types/<package>` for each library, or rely on the types the library ships.',
  },
  {
    from: ['abab'],
    alts: [{ label: 'atob() / btoa() (built in)' }],
    why: "Deprecated: use the platform's native atob() and btoa().",
    effort: 'trivial',
    notes: 'Both exist as globals in Node 16+ and in every browser.',
    snippet: { before: "const { atob } = require('abab');", after: '// atob is a global' },
  },
  {
    from: ['domexception'],
    alts: [{ label: 'DOMException (built in)' }],
    why: "Deprecated: use the platform's native DOMException.",
    effort: 'trivial',
    notes: 'DOMException is a global in Node 17+ and in browsers.',
  },
  {
    from: ['lodash.isequal'],
    alts: [{ label: "util.isDeepStrictEqual (Node, built in)" }, { label: 'dequal', pkg: 'dequal' }],
    why: 'Deprecated: use the built-in util.isDeepStrictEqual.',
    effort: 'trivial',
    notes: "Semantics differ slightly for edge cases such as NaN and prototypes; run your tests. In browsers use `dequal`.",
    snippet: { before: "import isEqual from 'lodash.isequal';", after: "import { isDeepStrictEqual } from 'node:util';" },
  },
  rename('eslint-loader', 'eslint-webpack-plugin', 'Deprecated: use eslint-webpack-plugin instead of the loader.', 'moderate',
    'Move the lint config from `module.rules` to `plugins: [new ESLintPlugin(...)]` in your webpack config.'),
  rename('extract-text-webpack-plugin', 'mini-css-extract-plugin', 'Deprecated: it does not support webpack 4+. Use mini-css-extract-plugin.', 'moderate',
    'Replace `ExtractTextPlugin.extract(...)` loaders with `MiniCssExtractPlugin.loader`.'),
  {
    from: ['enzyme-adapter-react-16', 'enzyme-adapter-react-17'],
    alts: [{ label: 'React Testing Library', pkg: '@testing-library/react' }],
    why: 'Enzyme has no official adapter for React 18 and later, so it blocks React upgrades.',
    effort: 'involved',
    legacy: true,
    notes: 'Rewrite tests around user-visible behaviour instead of component internals.',
  },
  {
    from: ['@vue/cli-service', '@vue/cli'],
    alts: [{ label: 'Vite (create-vue)', pkg: 'vite' }],
    why: 'Vue CLI is in maintenance mode; the Vue team recommends Vite-based create-vue for new work.',
    effort: 'involved',
    legacy: true,
    notes: 'Move the webpack-based build to Vite; replace vue.config.js options and `process.env.VUE_APP_*` with `import.meta.env.VITE_*`.',
  },

];

const INDEX = new Map<string, Replacement>();
for (const entry of KB) for (const name of entry.from) INDEX.set(name, entry);

export function findReplacement(name: string): Replacement | undefined {
  return INDEX.get(name);
}

export const KNOWN_REPLACEMENT_COUNT = INDEX.size;

/** Every package name that appears in a `from` list, including duplicates (used by tests). */
export const ALL_KB_NAMES: string[] = KB.flatMap((e) => e.from);

export function firstInstallable(alts: Alt[]): Alt | undefined {
  const first = alts[0];
  return first && first.pkg ? first : undefined;
}
