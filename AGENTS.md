# AGENTS.md

Instructions for any coding agent working on this repo. The task brief is the source of truth.

## How work is done here

1. One task = one branch = one pull request. Branch name: `task/<id>-<short-name>`, for example `task/t1-page-meta`.
2. The task brief says which files you may change. Do not touch anything else.
3. Before you open the PR, all of these must pass:

   ```bash
   npm test
   npm run check
   npm run build
   ```

4. In the PR description, list: what changed, the output of the three commands (last lines), and anything you were unsure about.
5. If the brief is unclear or a rule seems wrong, stop and write the question in the PR. Do not guess.

## Hard rules

- **Never set `verifiedOn`.** Only the owner sets it, after running the procedure.
- **No em dashes** anywhere: content, UI text, comments, commit messages.
- **Plain English.** Short sentences. No slogans, no "X isn't Y, it's Z", no "In this guide we will", no summaries that repeat the page.
- **No new dependencies** unless the brief allows it.
- Logic for tools goes in `src/lib/*.ts` with tests in `tests/`. Vue components only render.

## Stack quick facts

- Astro 7, Starlight 0.42, theme `starlight-theme-rapide`, Vue 3 islands.
- Pages: `src/content/docs/<section>/<page>.mdx`. Sidebar order: `sidebar.order` in frontmatter.
- Page meta line (level, verified, tools): `src/components/overrides/PageTitle.astro`.
- Tool styles: `src/styles/custom.css`. Tool root element needs `class="tool not-content"`.
- Starlight components in MDX: `import { Aside, Steps, Tabs, TabItem } from '@astrojs/starlight/components';`
