# Research Library Template

Build your own AI-maintained research knowledge base.

This is a reusable, static-first framework for a personal research library. It turns structured Git data into a fast public website: **Paper Pool** is the searchable collection, **Today’s Paper** is the daily recommendation, **Detail View** is a 5–10 minute reading brief, **Deep Read** is your manually marked reading progress, **Favorites** is your shortlist, and **My Notes** are durable researcher-owned Markdown notes. The template is domain-neutral: research direction, topics, language, and ranking preferences come from `config/research-profile.yaml`.

AI automation is designed for Codex CLI + ChatGPT account authentication. It does not require an OpenAI API key or paid OpenAI API usage. Codex/ChatGPT usage remains subject to the account's plan and limits.

## Getting Started — recommended: ask Codex

You do not need to understand Astro, GitHub Pages, GitHub Apps, Cloudflare, Codex CLI, or the internal code structure.

1. Copy this template repository URL.
2. Send the URL to Codex.
3. Tell Codex your name and research direction:

```text
Use this Research Library template to build my personal research library from scratch.

My name is <YOUR_NAME>.
My primary research direction is <YOUR_RESEARCH_DIRECTION>.
My secondary research interests are <OPTIONAL_INTERESTS>.

Please create the GitHub repository, configure the research profile, build, test, deploy GitHub Pages, and prepare the daily research automation.
```

4. Codex should create an independent repository, configure the profile and topic taxonomy, clear production examples, build/test/deploy Pages, and prepare the daily agent.
5. If GitHub, GitHub App, Cloudflare, or Codex login asks for a one-time authorization, complete that authorization in the official UI and return to Codex.

Create from `research-library-template`; do **not** fork `kangk-research-library`. A reference implementation can contain another researcher's scope and personal data. A template-created repository starts independently.

## From direction to a living library

```text
Research Direction → Codex → Research Profile → GitHub Repository
       → Build + Test → GitHub Pages → Personal Research Library
       → Daily Research Agent → Continuously Updated Knowledge Base
```

## Research Profile

`config/research-profile.yaml` is the central personalization file. Most users should let Codex generate it:

```yaml
profile:
  researcher: 'Your Name'
  library_name: 'Your Research Library'
research_scope:
  primary:
    - 'Your Primary Research Direction'
  secondary:
    - 'Optional Secondary Direction'
```

Different fields can use different topic taxonomies, venue preferences, ranking systems, and search strategies. CCF/CAS/JCR are not assumed; unknown rankings remain unknown.

Examples:

```text
Example 1 — Primary: LLM-based Code Generation
Secondary: AI4SE; Coding Agents

Example 2 — Primary: Multimodal Large Language Models
Secondary: Vision-Language Agents; Multimodal Reasoning

Example 3 — Primary: Time Series Forecasting
Secondary: Foundation Models for Time Series
```

## Daily workflow

```text
08:00 Beijing Time → Research Agent → Read Profile → Search multiple sources
→ Check existing Paper Pool → Select one quality/relevant paper
→ Quick Read + Detail → Validate → Commit + Push → GitHub Pages updates
```

Runs process one paper. If no new paper clears the quality bar, the agent recommends an existing high-quality paper that is not deep-read. Use **Get Another Paper** with `npm run paper:next` to run again; it checks duplicates and papers already recommended today.

## Owner editing and data ownership

The public site is read-only. Only the configured GitHub owner may use the optional authenticated editor to mark Deep Read, favorite a paper, change status, edit My Tags/My Notes, or correct generated content. A secure backend must perform OAuth state validation, short-lived sessions, owner checks, origin checks, and GitHub Contents API writes; the browser never receives a GitHub write token. If no backend is configured, the editor stays visibly disabled.

AI Summary is generated reading context. **My Notes** are the researcher's long-term Markdown memory, and **My Tags** are the researcher's own taxonomy. They are kept in `data/user/<paper-id>.json`, separate from generated `data/papers/<paper-id>.json`. The repository is also the backup: clone it, inspect history, and recover an earlier commit when needed.

## Get Another Paper

```bash
npm run paper:next
```

The wrapper performs a safe dry run unless `RUN_CODEX_AGENT=1` is set in a trusted authenticated environment. It invokes `prompts/daily-research-agent.md`, which searches multiple academic sources, checks DOI/arXiv/OpenReview/title identity, preserves notes/tags, and handles one recommendation.

## Change or migrate research direction

Edit `config/research-profile.yaml` and commit it; future agent runs use the new direction. Existing papers are not automatically deleted. For a major change, keep the current library or create a fresh independent library from this template rather than deleting history. Template and personal repositories are independent; this project does not claim an automatic upgrade workflow. Merge framework changes deliberately and protect Papers, Notes, Tags, Deep Read, and Favorites.

## Automation without OpenAI API

The recommended mode is an always-on trusted lab machine: cron/systemd → authenticated `codex exec --search` → validate/build → Git commit/push → Pages. See [`docs/AUTOMATION.md`](docs/AUTOMATION.md). A desktop scheduled task is also possible, but the computer/app must be available. Never create `OPENAI_API_KEY` for this project.

## Repository structure

```text
config/                 Personal research profile
data/papers/             Canonical paper records
data/user/               User state, notes, tags, favorites
data/daily/              Daily recommendation references
prompts/                 Bootstrap, daily agent, scheduled-task prompts
scripts/                 Validation, bootstrap, and agent wrapper
src/                     Astro pages, schema, library helpers, styles
tests/                   Unit, E2E, and fixture data
docs/                    Automation and operational notes
worker/                  Secure editor backend skeleton (secrets stay out of Git)
.github/workflows/       CI and GitHub Pages deployment
```

## Developer setup

```bash
git clone https://github.com/<owner>/<repository>.git
cd <repository>
npm install
npm run validate:data
npm test
npm run build
npm run dev
```

One-command acceptance checks are available as `npm run verify` (format check, lint, typecheck, data validation, unit tests, and build). Browser coverage is `npm run test:e2e` after installing the Playwright browser required by your environment.

## GitHub Pages verification

The Pages workflow runs validation and build before deployment, configures the project-site base path from the repository name, and deploys with GitHub Actions. In GitHub, confirm both CI and Pages workflow runs are green, then open `https://<owner>.github.io/<repository>/`. Check Home, Paper Pool search/filter/sort, a paper detail route, dark mode, and any configured owner editor. A first deployment or Pages setting may require selecting **GitHub Actions** as the Pages source in repository Settings.

## Troubleshooting

| Symptom                              | Fix                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub Pages 404                     | Confirm the URL includes `/<repository>/`, the Pages source is GitHub Actions, and the Pages run is green.                                                         |
| Pages build failure                  | Open the workflow log; run `npm run verify` locally and fix schema/type/build errors before pushing.                                                               |
| Missing CSS/JS or broken route       | Do not hard-code `/`; keep `import.meta.env.BASE_URL` links and push a new build.                                                                                  |
| Codex CLI not logged in/auth expired | Run `codex login` again with the ChatGPT account; do not add an API key.                                                                                           |
| `git push` permission denied         | Authenticate Git with the repository owner account and confirm repository write permission. Never paste a token into a file.                                       |
| Dirty repository                     | Stop the agent, review `git status`, preserve user changes, and run again only on a clean intentional checkout.                                                    |
| Research-agent lock                  | Confirm no process is active, then remove only `.research-agent.lock`.                                                                                             |
| Duplicate or schema validation error | Run `npm run validate:data`; fix identity fields, dangling references, enum values, URLs, or the record shape.                                                     |
| GitHub App/OAuth failure             | Check callback URL, allowed origin, owner username, short-lived session validation, and minimum Contents permission. Do not enable writes until owner checks pass. |
| Cloudflare Worker failure            | Inspect Worker logs and secret names; deploy only after one-time Cloudflare login. The static site still works without the editor.                                 |
| Website update is not immediate      | Wait for the Pages workflow and CDN propagation; verify the commit is on `main`.                                                                                   |
| Scheduled task did not run           | Check machine/app availability, timezone (`Asia/Shanghai`), scheduler logs, lock file, and Codex authentication.                                                   |

## Security notes

Never commit a GitHub PAT, GitHub App private key, OAuth client secret, Codex auth file, `.env`, or server secret. Never put a GitHub write token in frontend JavaScript or browser localStorage. Store secrets only in a protected server/secret store. Sanitize any Markdown before rendering HTML, validate URLs, use strict CORS and OAuth state, short-lived sessions, owner checks, conflict/SHA checks, and least-privilege App permissions. The included Worker implements the write path, but it must be deployed with real provider credentials and reviewed before enabling writes.

## FAQ

**Do I need to buy OpenAI API?** No. The default workflow uses Codex CLI and ChatGPT account authentication, subject to your account limits.

**Can I use it without coding?** Yes. Give Codex this template URL, your name, and research direction.

**Must my computer stay on?** Only for a local desktop scheduler. An always-on lab server can run the schedule instead.

**Can I change direction?** Yes, edit the Research Profile; existing papers remain.

**Can others read it?** Yes, the Pages site is public read-only. Only the owner can edit through the secure backend.

**Can others edit my notes?** Not without the corresponding GitHub owner authorization.

**Can I get multiple papers?** The safe default is one per run; manually run `npm run paper:next` repeatedly.

## Reproducibility review

Before sharing a new library, run `npm run verify`, follow the Developer setup above, run `npm run paper:next`, and inspect the Pages URL. Every command in this README maps to a checked-in npm script. A clean clone plus the configured GitHub/Codex account is sufficient; external Cloudflare/OAuth deployment is the only optional capability requiring its own one-time provider authorization.
