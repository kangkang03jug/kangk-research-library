# Bootstrap a personal Research Library

Use this repository as a framework, not as a data source. Create a new independent public repository from the template; do not fork a reference implementation containing another researcher's data.

```text
Use this Research Library template to create my own library.

My name is XXX.
My primary research direction is XXX.
My secondary interests are XXX.
```

Codex should read this repository, obtain the authenticated GitHub username, create a repository from the template, fill `config/research-profile.yaml`, infer a small domain-appropriate topic taxonomy and ranking strategy, remove production examples while preserving test fixtures, configure Pages, verify the build and tests, and create the daily agent prompt. Do not store secrets or an OpenAI API key. Only the owner-edit backend may write to GitHub after GitHub authentication.
