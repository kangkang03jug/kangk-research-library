import { defineConfig } from 'astro/config';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'research-library-template';
const owner = process.env.GITHUB_REPOSITORY_OWNER || 'kangkang03jug';

export default defineConfig({
  site: `https://${owner}.github.io`,
  base: process.env.GITHUB_ACTIONS === 'true' ? `/${repository}` : undefined,
  output: 'static',
  build: { format: 'directory' },
});
