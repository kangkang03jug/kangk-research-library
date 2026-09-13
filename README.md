# Research Library Template

Build your own AI-maintained research knowledge base.

This is a reusable, static-first framework for a personal research library. It turns structured Git data into a fast public website: **Paper Pool** is the searchable collection, **Today’s Paper** is the daily recommendation, **Detail View** is a 5–10 minute reading brief, **Deep Read** is your manually marked reading progress, **Favorites** is your shortlist, and **My Notes** are durable researcher-owned Markdown notes. The template is domain-neutral: research direction, topics, language, and ranking preferences come from `config/research-profile.yaml`.

The recommended automation is a cloud ChatGPT Scheduled Task with repository access. Codex CLI + cron/systemd remains available for an always-on lab server. Neither workflow requires an OpenAI API key; ChatGPT/Codex usage remains subject to the account's plan and limits.

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

4. Codex should create an independent repository, configure the profile and topic taxonomy, clear production examples, build/test/deploy Pages, generate a research-specific ChatGPT Scheduled Task prompt, and guide you through creating the daily task in ChatGPT.
5. If GitHub, GitHub App, Cloudflare, or Codex login asks for a one-time authorization, complete that authorization in the official UI and return to Codex.

Create from `research-library-template`; do **not** fork `kangk-research-library`. A reference implementation can contain another researcher's scope and personal data. A template-created repository starts independently.

## From direction to a living library

```text
Research Direction → Codex → Research Profile → GitHub Repository
       → Build + Test → GitHub Pages → Personal Research Library
       → ChatGPT Scheduled Task → Continuously Updated Knowledge Base
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
Configured Timezone → ChatGPT Scheduled Task → Read Profile → Search multiple sources
→ Check existing Paper Pool → Select one quality/relevant paper
→ Quick Read + Detail → Validate → Commit + Push → GitHub Pages updates
```

Runs process one paper. If no new paper clears the quality bar, the agent recommends an existing high-quality paper that is not deep-read. Use **Get Another Paper** with `npm run paper:next` to run again; it checks duplicates and papers already recommended today.

## Owner editing and data ownership

The public site is read-only until its optional editor backend is configured. After GitHub login, the Worker calls `/api/me`, reads the allowed Owner from `config/research-profile.yaml`, and enables editing only when the two GitHub usernames match. Non-owners remain read-only. Deep Read, Favorite, Status, My Tags, and My Notes update `data/user/<paper-id>.json`; AI summary corrections update only the summary fields in `data/papers/<paper-id>.json`.

The browser never receives a GitHub OAuth token, PAT, App private key, or installation token. It receives only a time-limited signed editor session. The session uses a 90-day sliding expiry: every successful authenticated `/api/me` or `/api/update` response renews it for another 90 days in both the `HttpOnly`, `Secure`, `SameSite=None` cookie and the browser-held signed editor credential. It expires after 90 days without successful activity and is never permanent; rotating `SESSION_SECRET` immediately invalidates every existing session. The Worker exchanges its GitHub App key for a short-lived installation token, obtains the latest file and SHA, restricts changes to approved fields, and writes through the GitHub Contents API. Concurrent changes return `409`; refresh before retrying. A successful save links to the commit and explains that Pages may take time to rebuild.

AI Summary is generated reading context. **My Notes** are the researcher's long-term Markdown memory, and **My Tags** are the researcher's own taxonomy. They are kept in `data/user/<paper-id>.json`, separate from generated `data/papers/<paper-id>.json`. The repository is also the backup: clone it, inspect history, and recover an earlier commit when needed.

### One-time Owner Editing deployment

These steps are required once per personal library; “configure OAuth” alone is not sufficient.

1. **Create a GitHub App.** In GitHub **Settings → Developer settings → GitHub Apps → New GitHub App**, use the library's Pages URL as the homepage. Disable webhooks unless they are needed elsewhere. Generate and download one private key. The same GitHub App supplies the OAuth Client ID/Client Secret used for Owner login.
2. **Set the callback URL.** It must be the deployed Worker URL followed by `/auth/callback`, for example `https://<worker>.<account>.workers.dev/auth/callback`. If the Worker URL is not known yet, deploy the skeleton once to reserve it, then return to the App settings and set the exact callback.
3. **Use minimum permissions.** Under Repository permissions grant **Contents: Read and write**. Keep **Metadata: Read-only** (GitHub includes it automatically). Do not grant Issues, Pull requests, Administration, Actions, organization, or account permissions. Request user identity only for login.
4. **Install the App only on the personal library repository.** Choose **Only select repositories**, select that repository, and record the numeric Installation ID from the installation URL or GitHub API.
5. **Prepare repository configuration.** Set `editor.owner_github_username` in `config/research-profile.yaml`. In `worker/wrangler.toml`, set `GITHUB_REPOSITORY = "<owner>/<repository>"` and normally keep `GITHUB_BRANCH = "main"`. The Template contains placeholders and never assumes a particular owner or repository.
6. **Log in to Cloudflare and deploy the Worker.** From the repository root run:

   ```bash
   npx wrangler login
   npx wrangler deploy --config worker/wrangler.toml
   ```

7. **Configure Worker secrets.** Run each command and paste the value only into Wrangler's protected prompt:

   ```bash
   npx wrangler secret put GITHUB_APP_ID --config worker/wrangler.toml
   npx wrangler secret put GITHUB_APP_PRIVATE_KEY --config worker/wrangler.toml
   npx wrangler secret put GITHUB_CLIENT_ID --config worker/wrangler.toml
   npx wrangler secret put GITHUB_CLIENT_SECRET --config worker/wrangler.toml
   npx wrangler secret put GITHUB_INSTALLATION_ID --config worker/wrangler.toml
   npx wrangler secret put SESSION_SECRET --config worker/wrangler.toml
   npx wrangler secret put ALLOWED_ORIGIN --config worker/wrangler.toml
   ```

   `GITHUB_APP_PRIVATE_KEY` is the complete PEM file. `SESSION_SECRET` must be a long random value. `ALLOWED_ORIGIN` is the exact Pages origin, such as `https://<owner>.github.io`, with no repository path. Deploy again after setting secrets.

8. **Expose only the Worker origin to the static build.** Set the repository Actions variable `PUBLIC_EDITOR_API_URL` to the Worker origin (no `/api` suffix):

   ```bash
   gh variable set PUBLIC_EDITOR_API_URL --body "https://<worker>.<account>.workers.dev" --repo <owner>/<repository>
   ```

   As a fallback, the same origin may be committed to `editor.api_origin` in the Research Profile; the Actions variable takes precedence.

9. **Redeploy and verify Pages.** Run the Pages workflow again, open a paper detail page, select **Sign in with GitHub**, and verify `/api/me`, personal-state saving, summary correction, the resulting commits, and the subsequent Pages deployment. Also test a different GitHub account and confirm it remains read-only.

Cloudflare and GitHub authorization cannot be fabricated by bootstrap code. Until the App, installation, secrets, and Worker URL exist, the website remains safely read-only.

## Get Another Paper

```bash
npm run paper:next
```

The wrapper performs a safe dry run unless `RUN_CODEX_AGENT=1` is set in a trusted authenticated environment. It invokes `prompts/daily-research-agent.md`, which searches multiple academic sources, checks DOI/arXiv/OpenReview/title identity, preserves notes/tags, and handles one recommendation.

## Change or migrate research direction

Edit `config/research-profile.yaml` and commit it; future agent runs use the new direction. Existing papers are not automatically deleted. For a major change, keep the current library or create a fresh independent library from this template rather than deleting history. Template and personal repositories are independent; this project does not claim an automatic upgrade workflow. Merge framework changes deliberately and protect Papers, Notes, Tags, Deep Read, and Favorites.

## Automation without OpenAI API

**Recommended:** create a cloud ChatGPT Scheduled Task using [`prompts/chatgpt-scheduled-task.md`](prompts/chatgpt-scheduled-task.md). It reads the Research Profile and existing Paper Pool, searches the web, processes one paper, validates the result, and writes to GitHub only when its connected GitHub access actually permits repository writes. If access is read-only or approval is required, it must report that limitation and must not claim a commit. This mode does not require the user's computer to remain on.

**Alternative:** Codex CLI + cron/systemd on an always-on trusted lab server remains supported through `scripts/run-research-agent.mjs`. Use it when the laboratory already operates a continuously available machine. See [`docs/AUTOMATION.md`](docs/AUTOMATION.md). Never create `OPENAI_API_KEY` for either mode.

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
worker/                  Secure Owner Editing backend (secrets stay out of Git)
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

| Symptom                              | Fix                                                                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Pages 404                     | Confirm the URL includes `/<repository>/`, the Pages source is GitHub Actions, and the Pages run is green.                                                                  |
| Pages build failure                  | Open the workflow log; run `npm run verify` locally and fix schema/type/build errors before pushing.                                                                        |
| Missing CSS/JS or broken route       | Do not hard-code `/`; keep `import.meta.env.BASE_URL` links and push a new build.                                                                                           |
| ChatGPT task cannot push             | Confirm the connected GitHub app has write permission for this repository. The task must report read-only access rather than claim success.                                 |
| Codex CLI not logged in/auth expired | For the server alternative, run `codex login` again with the ChatGPT account; do not add an API key.                                                                        |
| `git push` permission denied         | Authenticate Git with the repository owner account and confirm repository write permission. Never paste a token into a file.                                                |
| Dirty repository                     | Stop the agent, review `git status`, preserve user changes, and run again only on a clean intentional checkout.                                                             |
| Research-agent lock                  | Confirm no process is active, then remove only `.research-agent.lock`.                                                                                                      |
| Duplicate or schema validation error | Run `npm run validate:data`; fix identity fields, dangling references, enum values, URLs, or the record shape.                                                              |
| GitHub App/OAuth failure             | Check callback URL, allowed origin, owner username, time-limited sliding session validation, and minimum Contents permission. Do not enable writes until owner checks pass. |
| Cloudflare Worker failure            | Inspect Worker logs and secret names; deploy only after one-time Cloudflare login. The static site still works without the editor.                                          |
| Website update is not immediate      | Wait for the Pages workflow and CDN propagation; verify the commit is on `main`.                                                                                            |
| Scheduled task did not run           | Check ChatGPT **Scheduled**, task status, configured timezone, account/workspace app access, and recent run output. For the CLI alternative, also check the server.         |

## Security notes

Never commit a GitHub PAT, GitHub App private key, OAuth client secret, Codex auth file, `.env`, or server secret. Never put a GitHub write token in frontend JavaScript or browser localStorage. Store secrets only in a protected server/secret store. Sanitize any Markdown before rendering HTML, validate URLs, use strict CORS and OAuth state, time-limited sliding sessions, owner checks, conflict/SHA checks, and least-privilege App permissions. The included Worker implements the write path, but it must be deployed with real provider credentials and reviewed before enabling writes.

## FAQ

**Do I need to buy OpenAI API?** No. The recommended workflow uses a ChatGPT Scheduled Task and account-authorized apps, subject to your plan and workspace settings.

**Can I use it without coding?** Yes. Give Codex this template URL, your name, and research direction.

**Must my computer stay on?** Not for the recommended cloud ChatGPT Scheduled Task. It must stay on only when you intentionally choose a local task or the Codex CLI server alternative.

**Can I change direction?** Yes, edit the Research Profile; existing papers remain.

**Can others read it?** Yes, the Pages site is public read-only. Only the owner can edit through the secure backend.

**Can others edit my notes?** Not without the corresponding GitHub owner authorization.

**Can I get multiple papers?** The safe default is one per run; manually run `npm run paper:next` repeatedly.

## Reproducibility review

Before sharing a new library, run `npm run verify`, inspect the Pages URL, and manually test the ChatGPT Scheduled Task prompt against the intended repository permissions. Every command in this README maps to a checked-in script. Owner Editing additionally requires the one-time GitHub App and Cloudflare authorization documented above; without it, the public library remains read-only by design.
