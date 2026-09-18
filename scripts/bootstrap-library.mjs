import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (all, arg, i, arr) =>
        arg.startsWith('--') ? [...all, [arg.slice(2), arr[i + 1] || '']] : all,
      [],
    ),
);
if (!args.name || !args.primary) {
  console.error(
    'Usage: npm run bootstrap -- --name "Your Name" --primary "Research Direction" [--secondary "Interest 1,Interest 2"] [--library-name "Library"] [--github-owner username] [--summary-language zh-CN]',
  );
  process.exit(1);
}
const root = process.cwd();
const explanationLanguage = args['summary-language'] || 'zh-CN';
if (explanationLanguage === 'zh-CN' && !/[\u3400-\u9fff]/u.test(args.primary)) {
  console.error(
    'For zh-CN, pass the natural Chinese Hero direction produced during bootstrap; keep the original English term in --secondary when needed.',
  );
  process.exit(1);
}
const profile = {
  profile: {
    researcher: args.name,
    library_name: args['library-name'] || `${args.name}'s Research Library`,
    description:
      explanationLanguage === 'zh-CN'
        ? `围绕${args.primary}，整理相关论文、方法与可复现研究证据。`
        : 'A personal, searchable research knowledge base.',
  },
  research_scope: {
    primary: [args.primary],
    secondary: (args.secondary || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  },
  paper_selection: {
    recent_year_window: 3,
    priority: ['quality', 'relevance'],
    relevance_levels: ['High', 'Medium', 'Low'],
    ranking_systems: [],
    conferences: { prefer: [], allow: [] },
    journals: { prefer: [], allow: [] },
    preprints: { allowed: true, require_exact_source: true },
  },
  language: { explanation: explanationLanguage, terminology: 'mixed-zh-en' },
  daily: { papers_per_run: 1, timezone: 'Asia/Shanghai', scheduled_time: '08:00' },
  editor: { owner_github_username: args['github-owner'] || '', api_origin: '' },
};
fs.writeFileSync(
  path.join(root, 'config/research-profile.yaml'),
  yaml.dump(profile, { lineWidth: 100 }),
);
for (const dir of ['data/papers', 'data/user', 'data/daily']) {
  const target = path.join(root, dir);
  fs.mkdirSync(target, { recursive: true });
  for (const f of fs.readdirSync(target))
    if (f.endsWith('.json')) fs.unlinkSync(path.join(target, f));
}
console.log('Profile generated and production data cleared. Tests remain under tests/fixtures.');
