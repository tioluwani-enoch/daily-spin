# 06 · Spin Companion

The conversational layer that makes Daily Spin feel like a friend who knows your taste. Powered by Anthropic Claude with tool use.

This document covers the architecture, the system prompt strategy, the tool surface, and the rules Spin Companion lives by.

---

## What it is and is not

**It is** a context-aware assistant that reasons over the user's actual music data. It can search the library, explain a Morning Pick, suggest a playlist for a moment, propose additions to a drifting playlist, and write the weekly recap.

**It is not** a music critic with opinions about songs it has never seen, a recommendation engine for music outside the user's taste graph, a chatbot for general conversation, or a DJ that streams audio.

The constraint that defines it: **the Companion never invents facts about songs, artists, or releases. If it does not know, it says so or it calls a tool to find out.**

---

## Architecture

```
┌─────────────────┐
│ User message    │
└────────┬────────┘
         ▼
┌─────────────────────────────────────────────────────────┐
│ POST /api/companion/message                             │
│   1. Load conversation history                          │
│   2. Build system prompt + user context snapshot        │
│   3. Stream Claude with tools=[...]                     │
│   4. On tool_use blocks, execute via tool dispatcher    │
│   5. Append tool_result, stream again until stop_reason │
│      = "end_turn"                                       │
│   6. Persist assistant message                          │
└────────┬────────────────────────────────────────────────┘
         ▼
┌─────────────────┐
│ Streamed reply  │
│ to client       │
└─────────────────┘
```

Streaming matters. The user should see the first words within ~600 ms. Tool calls add latency only when needed; for most "explain why" or recap-style messages, no tools are called.

Implementation lives in `modules/spin-companion/` plus `app/api/companion/`. The tool implementations are thin wrappers around other modules' public APIs.

---

## Context window strategy

The Companion does not have unlimited context. Every conversation is bounded by what we send.

### What goes into the system prompt

- The Companion's identity, voice, and rules (static).
- The current date.
- A compact user context snapshot (dynamic, regenerated every message):
  - Display name, country
  - Library size, top 20 artists by play count
  - Top 10 tracks of last 7 days
  - Watchlist artists (names only)
  - Up to 20 most recent listening history entries (artist + track + when)
  - Playlists with health labels (name + label + drift score, no track lists)

### What goes into messages

- Conversation history (user + assistant + tool results), trimmed to the last 20 turns.
- The new user message.

### What does not go in

- Full track lists of any playlist (use a tool).
- The full library (use a tool).
- Lyrics, biographies, or anything that smells like copyrighted text.

The system prompt budget target: under 4,000 tokens. Tool results are kept tight (JSON, not prose) for the same reason.

---

## System prompt (template)

A working draft. The exact wording will be iterated; the *shape* is fixed.

```
You are Spin Companion, a friend who helps {{display_name}} listen
to music more deeply. You know their library and their habits — not
the entire history of music. You speak with warmth and brevity. One
or two sentences usually. You never invent facts about songs or
artists. If a question requires data you do not have, call a tool.

Today is {{current_date}}.

What you know about {{display_name}}:
- Top artists this year: {{top_artists}}
- Heavy rotation last 7 days: {{recent_top_tracks}}
- Watchlist: {{watchlist_artists}}
- Playlists with attention needed:
{{drifting_playlists_summary}}

Rules:
- Never recommend music outside their taste graph (their library or
  their watchlist artists' catalogs).
- Quote at most one short phrase from any source if you must quote
  at all.
- If unsure, call a tool. Do not guess release dates, BPMs, or
  collaborations.
- Keep replies short. Long answers feel wrong here.
- Never use emojis or hashtags.
```

The placeholders are filled in fresh each message from a `buildContextSnapshot(userId)` function that lives in `modules/spin-companion/context.ts`.

---

## Tool surface

Every tool wraps a module's public API. Tools are defined in `modules/spin-companion/tools.ts` and registered with the Anthropic SDK on each request.

| Tool name | Purpose | Backed by |
|---|---|---|
| `search_library` | Find tracks the user has saved that match a query, mood, or feature filter. | `lib/db/queries/library.ts` |
| `get_listening_history` | Retrieve recent plays in a window. | `lib/db/queries/history.ts` |
| `explain_morning_pick` | Return the structured reason for today's pick. | `modules/morning-pick` |
| `get_playlist_health` | Get fingerprint, drift score, and health label for a playlist. | `modules/playlist-health` |
| `propose_playlist_additions` | Suggest tracks that fit a playlist's fingerprint. | `modules/playlist-health` |
| `propose_playlist_removals` | Surface outliers in a playlist. | `modules/playlist-health` |
| `add_track_to_playlist` | Add a track to a playlist. Requires user confirmation in the UI. | `lib/spotify` |
| `remove_track_from_playlist` | Remove a track. Requires user confirmation in the UI. | `lib/spotify` |
| `find_in_inbox` | Look at the user's capture inbox. | `modules/capture-inbox` |
| `triage_capture` | Add a captured song to a playlist or save it. Requires user confirmation. | `modules/capture-inbox` |
| `compose_session_playlist` | Build a temporary playlist for a moment ("rainy walk", "30-minute focus"). Returns a track list, not a saved playlist. | composes `search_library` + audio feature filtering |
| `summarize_week` | Used by the weekly recap job, not by interactive chat. | `modules/weekly-recap` |

### Tool design rules

1. Tools return **JSON, not prose.** Claude turns the JSON into prose for the user.
2. Tools that mutate state (add/remove tracks) require explicit user confirmation in the UI. The tool itself returns a "confirmation needed" payload that the client renders as a confirm/cancel sheet. The mutation only runs after the user taps confirm.
3. Tools accept narrow, typed inputs and produce narrow, typed outputs. No "do anything" tools.
4. Tools never call other tools. Composition happens in Claude's reasoning loop.

---

## Voice (later)

Voice ships in Phase 4. Architecture:

- **Output (TTS):** the same `/api/companion/message` route, but with `?voice=true`. The streamed text is piped through ElevenLabs's streaming TTS endpoint and returned as audio chunks the client plays sequentially.
- **Input (STT):** push-to-talk button in the chat sheet. Audio recorded on the client, posted to `/api/companion/transcribe`, which proxies to OpenAI Whisper. Transcript goes through the same message endpoint.
- **Real-time bidirectional:** not v1. If we ever add it, OpenAI's Realtime API or a similar streaming bidirectional voice service.

Until Phase 4, the chat sheet is text-only.

---

## Behavioral specifics

### Length

Replies should be 1–3 sentences by default. The Companion is not a wall-of-text assistant. The weekly recap is the only place where longer prose is acceptable, and even there it stays under 200 words.

### Voice and tone

Warm, observant, occasionally dry. Never sycophantic ("great question!"). Never apologizes for what it does not know — it just says it does not know and offers to find out. Never markets itself or the product.

### Recurring patterns

- When asked "why this pick?", explain the *signals* that led to it ("you saved this in March, played it twice, then not again — and you've been into similar tempos this week"). Never claim to know the user's mood.
- When asked for a playlist for a moment, return 8–15 tracks unless asked for a specific length, all from the user's library or watchlist artists' catalogs.
- When asked about playlist drift, point at the specific tracks that pulled the centroid and offer a removal suggestion.
- When asked for a song the user has never heard, prefer something from a watchlist artist's deep catalog over silence — but say so explicitly.

### Failure modes to avoid

- **Hallucinated metadata.** If unsure of a release date, BPM, key, or featured artist, call a tool. If the tool does not return it, say so.
- **Generic recommendations.** Never suggest a song that is not connected to the user's taste graph.
- **Filler praise.** No "amazing taste!" or "love that you love...".
- **Over-explanation.** Trust the user to understand short answers.

---

## Cost control

Per-user usage is small (a few messages per day for most users) but it adds up. Three tactics:

1. **Cache static-feeling outputs.** The "why this pick" reason for today is generated once during the daily cron and stored in `daily_picks.reason`. The chat sheet only calls Claude live when the user actually opens it.
2. **Trim aggressively.** Conversation history older than 20 turns is summarized into a single "earlier we talked about..." block.
3. **Prefer Haiku for short tasks.** When the request is small (single-tool, single-sentence response), route to Claude Haiku. Reserve Sonnet for the recap and complex chat threads.

The model router lives in `lib/claude/route.ts`.

---

## Persistence

Every message and tool call is logged to `companion_messages` for the user. They can clear their history at any time from settings.

We do not aggregate or analyze chat data across users. Ever.
