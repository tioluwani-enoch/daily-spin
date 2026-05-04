# 08 · Modules

This folder is the per-module spec library. Each markdown file here corresponds to one feature module under `src/modules/`.

Read the spec for a module **before** writing or modifying its code. The spec is the source of truth for what the module does, what it owns, and what it exposes.

---

## Module index

| Module | Spec | Owns | Owned by |
|---|---|---|---|
| Morning Pick | [morning-pick.md](morning-pick.md) | daily track selection algorithm, `daily_picks` table | morning ritual screen |
| Artist Watchlist | [artist-watchlist.md](artist-watchlist.md) | watchlist CRUD, `new_releases` feed | morning ritual screen, settings |
| Capture Inbox | [capture-inbox.md](capture-inbox.md) | capture write path, resolution, triage | morning ritual screen, share extension |
| Playlist Health | [playlist-health.md](playlist-health.md) | fingerprints, drift, suggestions | playlists view, Companion |
| Weekly Recap | [weekly-recap.md](weekly-recap.md) | Sunday recap generation | recap screen |
| Spin Companion | [`../06-spin-companion.md`](../06-spin-companion.md) | conversational orchestration | (cross-cutting) |

Spin Companion lives in its own top-level doc because it spans every other module via tool calls.

---

## What goes in a module spec

Every module spec follows the same shape so an AI agent can navigate them by structure alone:

1. **Purpose** — one paragraph: what this module does and why it exists.
2. **Public API** — the exact functions/types exported from `index.ts`. Other modules consume only these.
3. **Data ownership** — which tables the module reads and which it writes.
4. **Algorithm or behavior** — the core logic, written in English plus pseudocode.
5. **UI surface** — which routes/components belong to this module.
6. **Edge cases and failure modes** — what happens when things go wrong.
7. **Tests** — what to verify and at what layer.

If a spec is missing one of these sections, fix the spec before changing the code.

---

## Adding a new module

Before adding a new module, ask: can this be solved by extending an existing one? Most "new features" are.

If a new module is genuinely needed:

1. Write the spec first. Land it as a doc-only PR. Get a review on the boundaries before code.
2. Create `src/modules/<name>/` with `index.ts`, `repository.ts`, and a `ui/` folder.
3. Update the index table above.
4. Update `docs/02-architecture.md` if the module map needs to change.
5. Then write code.

---

## Module independence

Modules **do not import from each other**. They communicate through:

- The database (one module writes, another reads).
- Spin Companion's tool dispatcher (Companion composes modules at runtime).
- Server-side orchestration in API route handlers (e.g., the capture triage handler calls Capture Inbox and Playlist Health).

If you find yourself wanting `import { foo } from "@/modules/other-module"`, stop and re-read this section.
