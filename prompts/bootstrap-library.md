# Bootstrap a personal Research Library

Use this repository as a framework, not as a data source. Create a new independent public repository from the template; do not fork a reference implementation containing another researcher's data.

```text
Use this Research Library template to create my own library.

My name is XXX.
My primary research direction is XXX.
My secondary interests are XXX.
```

Codex should read this repository, obtain the authenticated GitHub username, and then:

1. Create an independent repository from this template and configure `config/research-profile.yaml`.
2. Infer a small domain-appropriate topic taxonomy and ranking strategy, remove production examples while preserving test fixtures, and verify all tests and the build.
3. Deploy GitHub Pages and verify the public routes.
4. Generate a research-direction-specific ChatGPT Scheduled Task prompt from `prompts/chatgpt-scheduled-task.md`, using the time and timezone in the Research Profile.
5. Guide the owner to create the daily task in ChatGPT **Scheduled** and verify whether its GitHub connection has real repository write permission. If write permission is unavailable, the task must report that limitation rather than pretending to commit.

Set `language.explanation` to the owner's requested paper-summary language; default to `zh-CN` when no preference is given. This setting controls all AI-generated paper summary and analysis text independently of the bilingual UI, while `original_abstract` always remains verbatim in its source language. Do not require an always-on personal computer or server for the recommended ChatGPT Scheduled Task. Keep Codex CLI + cron/systemd as an optional server-based alternative. Do not store secrets or an OpenAI API key. Only the authenticated Owner Editing backend may write from the public website.
