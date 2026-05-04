# Daily Spin · Docs

This folder is the project's brain. Anyone — human or AI agent — building or contributing to Daily Spin should start here.

## How to read these docs

If you are new to the project, read in this order:

1. [`00-vision.md`](00-vision.md) — the why
2. [`01-product-spec.md`](01-product-spec.md) — the what
3. [`02-architecture.md`](02-architecture.md) — the shape
4. [`03-tech-stack.md`](03-tech-stack.md) — the choices
5. [`04-data-model.md`](04-data-model.md) — the schema
6. [`07-design-system.md`](07-design-system.md) — the look and feel
7. [`08-modules/`](08-modules/) — per-feature specs
8. [`09-roadmap.md`](09-roadmap.md) — the build plan

Read [`05-spotify-integration.md`](05-spotify-integration.md) and [`06-spin-companion.md`](06-spin-companion.md) when you start working on the relevant subsystem.

## For AI coding agents

Before writing or modifying code:

- Always read the relevant module spec under [`08-modules/`](08-modules/) first.
- Check [`10-conventions.md`](10-conventions.md) for code style and file organization.
- Modules **do not import from each other**. They communicate through the database or via Spin Companion's tool dispatcher. See `02-architecture.md` for the boundary rules.
- If a doc and the code disagree, fix the doc first, then the code. The doc is the source of truth.

## File map

```
docs/
├── index.md                  ← this file
├── 00-vision.md              ← problem, audience, principles
├── 01-product-spec.md        ← features and user flows
├── 02-architecture.md        ← system shape and module map
├── 03-tech-stack.md          ← chosen tools and rationale
├── 04-data-model.md          ← database schema
├── 05-spotify-integration.md ← OAuth, endpoints, sync strategy
├── 06-spin-companion.md      ← LLM design and tool surface
├── 07-design-system.md       ← visual identity and ambient theming
├── 08-modules/               ← per-module specs
│   ├── index.md
│   ├── morning-pick.md
│   ├── artist-watchlist.md
│   ├── capture-inbox.md
│   ├── playlist-health.md
│   └── weekly-recap.md
├── 09-roadmap.md             ← phased build plan
├── 10-conventions.md         ← code style and conventions
└── 11-glossary.md            ← domain terms
```
