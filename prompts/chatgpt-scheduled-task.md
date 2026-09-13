# ChatGPT Scheduled Task: daily research update

Run daily at the time and timezone defined in `config/research-profile.yaml` (for example, `08:00 Asia/Shanghai`). Use the connected GitHub repository as the source of truth. Read `prompts/daily-research-agent.md`, the Research Profile, all existing Paper Pool and user-state records, and today's daily archive before doing any work.

Use Web Search and multiple reliable academic sources. Deduplicate first and process exactly one paper. If no new paper clears the quality bar, recommend an existing high-quality paper that is not Deep Read and has not already been recommended today. Preserve My Notes, My Tags, Deep Read, and Favorites. Generate all AI summaries and analysis in `language.explanation`; the UI locale does not control paper-body language, and Original Abstract remains verbatim.

Before changing the repository, confirm that this task has authenticated GitHub write permission for this repository. Run data validation, tests, and the production build, then commit and push `main` only if every check succeeds. A successful push should trigger GitHub Pages. If GitHub write permission is missing, read-only, requires approval, or the push fails, report the exact limitation and do not claim that a commit or deployment occurred. Do not use an OpenAI API key.
