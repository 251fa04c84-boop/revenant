import { defineConfig } from 'vitest/config';

// Relative base so the static build works on GitHub Pages sub-paths, Vercel, Netlify, or any static host.
export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
