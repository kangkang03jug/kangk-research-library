# Reusable Research Library Framework

This repository is a reusable, static-first Research Library framework. Do not hard-code a researcher, field, venue ranking, or topic into UI logic. Personalization belongs in `config/research-profile.yaml`; paper content belongs in `data/papers/`; user-owned state belongs in `data/user/`.

Before changing data, run `npm run validate:data`. Preserve My Notes, My Tags, Deep Read, and Favorites when regenerating AI content. Never add secrets, GitHub tokens, OAuth secrets, or OpenAI API keys to the repository or frontend. The public site is read-only unless a separately deployed backend authenticates the configured owner.
