import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'alice/alice-research-library',
  GITHUB_REPOSITORY_OWNER: 'alice',
};

execFileSync(npm, ['run', 'build'], { env, stdio: 'inherit', shell: process.platform === 'win32' });

const distRoot = join(process.cwd(), 'dist');
const htmlFiles = [];
function collect(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.name.endsWith('.html')) htmlFiles.push(path);
  }
}
collect(distRoot);
if (!htmlFiles.length) throw new Error(`No HTML output found under ${distRoot}`);

const html = htmlFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
for (const route of ['/', '/paper-pool/', '/deep-read/', '/daily-archive/', '/favorites/']) {
  const href = `/alice-research-library${route}`;
  if (!html.includes(`href="${href}"`)) throw new Error(`Missing base-aware link: ${href}`);
}
const papersDir = join(process.cwd(), 'data', 'papers');
if (existsSync(papersDir)) {
  for (const file of readdirSync(papersDir).filter((name) => name.endsWith('.json'))) {
    const paper = JSON.parse(readFileSync(join(papersDir, file), 'utf8'));
    const href = `/alice-research-library/papers/${paper.id}/`;
    if (!html.includes(`href="${href}"`)) throw new Error(`Missing base-aware paper link: ${href}`);
  }
}
if (html.includes('/alice-research-librarypaper-pool/')) {
  throw new Error('Found a project-site URL with a missing slash after the base path');
}

console.log(`Base-path smoke test passed for ${htmlFiles.length} HTML files.`);
