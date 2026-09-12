# Automation

## Recommended: always-on trusted machine

1. Install the Codex CLI and authenticate with the ChatGPT account (`codex login`; use device authentication on a headless server when offered).
2. Clone the personal library and test `codex exec --search "Read prompts/daily-research-agent.md and perform one dry run."`.
3. Run `npm ci`, `npm run validate:data`, and `npm run build` once.
4. Schedule `scripts/run-research-agent.mjs` at 08:00 in `Asia/Shanghai` with cron or a systemd timer. Configure the server timezone explicitly and invoke the script from the repository directory.
5. Set `RUN_CODEX_AGENT=1` only in the trusted process environment. The wrapper locks concurrent runs, logs, and removes its lock on completion. The agent itself must validate, test, build, commit, and push only after success.

The script never contains a token or API key. Keep Codex credentials in the CLI's protected account store, and keep GitHub credentials in the normal Git credential helper or SSH agent.

## Desktop scheduled task

The prompt in `prompts/chatgpt-scheduled-task.md` can be copied to a ChatGPT/Codex Scheduled Task. A local/worktree task can run now or daily, but the computer and relevant app/environment must be available. It does not turn a read-only GitHub connector into a write connector.

## Manual Run Next Paper

Run `npm run paper:next` for a safe dry-run wrapper, or set `RUN_CODEX_AGENT=1` in a trusted, authenticated environment. The agent checks duplicates and today's archive and processes one next recommendation.

## Recovery

If a run fails, inspect its log and `git status`; no bad commit should be created. If `.research-agent.lock` remains after a process crash, first confirm no agent is running, then remove only that file and retry. Resolve push conflicts with `git pull --ff-only` and never overwrite user notes.
