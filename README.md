# Uploading Manual

A beginner manual for remuxing, encoding and uploading, with calculators.

## Run it

Needs Node 22.23 or newer.

```bash
npm install
npm run dev       # http://localhost:4321, search does not work in dev
npm run build     # static site in dist/, with search index
npm run preview   # serve dist/ locally
npm test          # unit tests for the calculator logic
npm run check     # type check
```

The build fails on any broken internal link, including links to headings.

## Where things are

```
src/
├─ content/docs/          one .mdx file per page; folders are sidebar groups
│  ├─ basics/  remux/  encode/  audio-subs/  upload/
│  ├─ tools/              pages that host the Vue tools
│  └─ reference/
├─ components/
│  ├─ tools/*.vue         the interactive tools
│  └─ overrides/          Starlight component overrides (page meta line)
├─ data/tiers.ts          size tier helper used by the bitrate calculator
├─ lib/*.ts               calculator logic, no UI, covered by tests/
└─ styles/custom.css      tool styles
```

## Add a page

Create an `.mdx` file in the right folder. The sidebar, search and previous/next links update by themselves.

```mdx
---
title: Page title
description: One sentence. Shown under the title and in search.
sidebar:
  order: 50          # position inside its group
level: beginner      # beginner | intermediate | advanced
tools: ['StaxRip 2.52', 'MediaInfo']
verifiedOn: 2026-11-05   # only after running the procedure end to end
video: https://...       # optional walkthrough link
---
```

Procedure pages follow this outline: Who this is for / When you use this / Before you start / Steps / Stop and ask someone if / What good looks like / Related.

**Never fill in `verifiedOn` without doing the procedure.** Pages with tools and no date show "not verified yet". After 180 days the date turns amber.

Components available in MDX (import them at the top of the file):

```mdx
import { Aside, Steps, Tabs, TabItem, Card, CardGrid } from '@astrojs/starlight/components';

<Aside type="caution" title="Short title">Text</Aside>   // note | tip | caution | danger
```

## Add a tool

1. Put the logic in `src/lib/<tool>.ts` as plain functions, and add tests in `tests/`.
2. Put the UI in `src/components/tools/<Tool>.vue`. Give the root element `class="tool not-content"`.
3. Use it in a page under `src/content/docs/tools/` with `<Tool client:load />`.

## Deploy on the home server

```bash
docker compose up -d --build
```

Serves the site on port 8080 with nginx. Put it behind your reverse proxy.
