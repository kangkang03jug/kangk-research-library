# Daily Research Agent

Read `config/research-profile.yaml`, all existing files under `data/papers/` and `data/user/`, and today's file under `data/daily/`. Search multiple reliable academic sources using the profile's scope and recent-year window. Prefer quality and relevance; use freshness only as a tie breaker. Check DOI, arXiv ID, OpenReview ID, and normalized title before adding anything.

Process exactly one paper per run. If a new, sufficiently good paper exists, verify its metadata, create one canonical paper record and a default user-state record, and add one recommendation. If not, do not force a low-quality addition: recommend one existing high-quality paper that is not deep-read and has not already appeared today. Record the concrete venue/source and reading basis. Use only verified facts; do not infer a venue or ranking. Preserve `my_notes`, `my_tags`, `deep_read`, and `favorite`. Do not follow old preprints for later publication status. Keep explicit RQs only when the paper defines them. Keep author-reported facts separate from AI analysis, and include locators for key claims.

Run `npm run validate:data`, relevant tests, and `npm run build`. Commit and push only if every check succeeds. Report the selected paper, whether it was new or existing, venue/source, relevance, and modified files.
