# Scheduled task: daily research update

Every day at 08:00 in `Asia/Shanghai`, use an authenticated Codex session to read `prompts/daily-research-agent.md` and execute one run in the configured local repository. Search the web, preserve user state, validate data, and commit/push only on success. If no new paper clears the quality bar, recommend an existing not-yet-deep-read paper. Write all AI-generated paper summaries and analysis in `config/research-profile.yaml -> language.explanation`; the UI locale switch must not alter that language, and `original_abstract` must remain verbatim in its source language. Do not use an OpenAI API key.

If this task is bound to a local Git repository, the trusted machine must be on and the relevant app/environment available. A cloud or server workflow is possible only when the account/project explicitly has secure repository write access; ordinary read-only connectors must not be assumed to push.
