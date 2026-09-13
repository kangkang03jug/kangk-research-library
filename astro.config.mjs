import { defineConfig } from 'astro/config';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'research-library';
const owner =
  process.env.GITHUB_REPOSITORY_OWNER ||
  process.env.GITHUB_REPOSITORY?.split('/')[0] ||
  'research-library-owner';

export default defineConfig({
  site: `https://${owner}.github.io`,
  base: process.env.GITHUB_ACTIONS === 'true' ? `/${repository}` : undefined,
  output: 'static',
  build: { format: 'directory' },
});
