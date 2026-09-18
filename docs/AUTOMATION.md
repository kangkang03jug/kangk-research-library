# Automation

## Recommended: ChatGPT Scheduled Task

Create a recurring task in ChatGPT and use `prompts/chatgpt-scheduled-task.md` as its instructions. Set the schedule from `config/research-profile.yaml`; the default example is `08:00 Asia/Shanghai`. Each run must:

1. Read the Research Profile, daily-agent prompt, Paper Pool, user state, and today's archive.
2. Search multiple academic sources, deduplicate first, and process exactly one paper.
3. Generate summaries in the configured explanation language and preserve Owner notes, tags, Deep Read, and Favorites.
4. For a task with a local checkout, validate data, run tests, and build before writing. A cloud task that only has connected GitHub access must perform the structural/data checks it can perform, make one atomic commit, and use the Pages workflow's `validate:data`/build/deploy as the hard post-push gate. It must inspect CI and repair failures caused by its own commit, while reporting unrelated pre-existing CI baseline failures separately; it must never claim that local commands ran when they did not.
5. Commit and push only when the task has authenticated GitHub write permission for this exact repository. A read-only connector, an ambiguous repository, or an approval prompt is a hard stop; report it explicitly and do not claim success.

ChatGPT Scheduled Tasks can run recurring work and use supported connected apps when they are available for the account or workspace. Create and manage the task in ChatGPT's **Scheduled** view. See the [official ChatGPT Scheduled Tasks documentation](https://learn.chatgpt.com/zh-Hans/docs/automations). A cloud task that works through connected GitHub access does not require the user's computer to remain on. Do not bind the recommended task to uploaded project files or an unavailable local checkout.

Suggested setup:

1. Connect the repository-capable GitHub app in ChatGPT and grant only the repository access needed for this library.
2. Open ChatGPT **Scheduled**, create a daily task, paste `prompts/chatgpt-scheduled-task.md`, and select the configured time and timezone.
3. Run it once manually. Confirm that it can read the current Paper Pool and, when write access is intended, create a real commit on `main` for this exact repository.
4. Confirm the commit's Pages validation/build and deployment complete successfully, and inspect CI for regressions. A cloud task does not need a local checkout to run; if it cannot execute `npm`, it must not block after structural checks or falsely report local validation.

No OpenAI API key is used.

## Alternative: Codex CLI on an always-on server

Keep this option for a trusted lab server that is already online continuously:

1. Install Codex CLI and authenticate with the ChatGPT account.
2. Clone the personal library and test `codex exec --search "Read prompts/daily-research-agent.md and perform one dry run."`.
3. Run `npm ci`, `npm run validate:data`, and `npm run build` once.
4. Schedule `scripts/run-research-agent.mjs` with cron or a systemd timer using the profile timezone.
5. Set `RUN_CODEX_AGENT=1` only in the trusted process environment.

The wrapper locks concurrent runs. Keep Codex credentials in its protected account store and GitHub credentials in the normal credential helper or SSH agent. This alternative requires the server and scheduler to stay online.

## Manual Run Next Paper

Run `npm run paper:next` for a safe dry-run wrapper, or set `RUN_CODEX_AGENT=1` in a trusted, authenticated environment. The agent checks duplicates and today's archive and processes one next recommendation.

## Recovery

If a run fails, inspect its report, commit, and workflow status. A cloud run must not treat a Pages validation/build/deploy failure as successful: use the relevant log to make a focused repair commit and wait for Pages again. Repair CI failures when they are caused by the run; record unrelated pre-existing CI baseline failures without misreporting them as green. For the local CLI alternative, keep the pre-commit checks and do not create a commit that fails them. If `.research-agent.lock` remains after a process crash, first confirm no agent is running, then remove only that file and retry. Resolve push conflicts without overwriting user notes.
