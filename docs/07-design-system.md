# 07 · Design System

The interface should feel like the inside of a record sleeve — quiet, considered, warm. Not a dashboard. Not a music player. A small, careful room.

This document defines the visual identity, the ambient theming engine, typography, motion, and components. It is the contract every UI component lives by.

---

## Core principle: ambient theming

Daily Spin's signature is that the interface breathes with the music. The visual baseline is **soft and ambient** — low-contrast, warm, generous whitespace. From there, the palette and motion shift in response to whatever the user is currently playing.

**Three drivers feed the theme:**

1. **The album art.** A muted palette is extracted from the cover of the currently playing track. Two colors and a neutral are derived (a wash, an accent, and an edge tone). The wash becomes the page background gradient. The accent tints links and key UI moments. The edge tone shows up in dividers and subtle outlines.
2. **The audio features.** Energy and valence influence saturation and contrast. A high-energy track lifts the contrast slightly and warms the palette. A low-energy track flattens contrast and cools it. Tempo influences motion timing — pulses and transitions match BPM, scaled to feel calm rather than aggressive.
3. **Time of day.** A baseline overlay shifts subtly across the day. Mornings lean warmer and lower-contrast; evenings tilt cooler and slightly more saturated. This baseline is gentle enough that users barely notice it consciously.

When nothing is playing, the theme falls to a default soft-ambient state described below.

### How it works under the hood

All theming is expressed through CSS variables on `:root`. Components only ever read `var(--ambient-*)` — they never know about the engine.

| Variable | Purpose | Example default |
|---|---|---|
| `--ambient-bg` | page background gradient stop 1 | `#F4EFE9` |
| `--ambient-bg-alt` | page background gradient stop 2 | `#EAE3DA` |
| `--ambient-fg` | primary text | `#1F1B17` |
| `--ambient-muted` | secondary text | `#6B645C` |
| `--ambient-edge` | hairlines, dividers | `#D9D2C8` |
| `--ambient-accent` | links, primary actions | `#7A6244` |
| `--ambient-accent-soft` | hover/active state | `#9A805F` |
| `--ambient-pulse-ms` | base motion duration | `1200ms` |
| `--ambient-energy` | 0–1 energy scalar | `0.5` |
| `--ambient-valence` | 0–1 valence scalar | `0.5` |

The engine writes these values to `document.documentElement.style` on every theme change. Tailwind config maps semantic tokens to these variables so utilities like `bg-ambient` or `text-ambient-fg` "just work."

Defaults represent the off-state when nothing is playing — a warm paper tone, like an unlit lamp in a small room.

### Implementation summary

`lib/theme/extract.ts`

- Takes an image URL (album art).
- Loads it into a hidden `<canvas>`, samples pixels at a coarse grid.
- Quantizes to a small palette via a simple median-cut or k-means in RGB.
- Picks two dominant non-greyscale colors (wash, accent), derives an edge tone from the most desaturated cluster.
- Adjusts toward the soft-ambient target: caps saturation, raises lightness for the wash, drops it for the accent.
- Returns `{ bg, bgAlt, fg, muted, edge, accent, accentSoft }`.

`lib/theme/audio.ts`

- Maps `audio_features` → modulators:
  - `energy` raises overall saturation by up to 8%.
  - `valence` shifts hue toward warmer (high) or cooler (low) by up to 4 degrees.
  - `tempo` sets `--ambient-pulse-ms` to a value that feels relaxed at the track's BPM (typically `60000 / tempo * 2` ms, capped at 1800).

`lib/theme/provider.tsx`

- React context that exposes `useAmbientTheme()` and a `setTrack(track)` mutator.
- Listens to the currently-playing poller; when the track changes, it kicks `extract` and `audio.ts`.
- Transitions between themes are eased over 1.5–2.5 seconds — never an abrupt color flip.

---

## Typography

Two type families. No more.

- **Display / body:** a humanist sans-serif with strong italics. Default candidate: **Inter** (variable), with fallbacks `system-ui, -apple-system`. Choose a serif for h1 if it ever feels right (later iteration; not v1).
- **Mono accents:** for timestamps, BPMs, durations, fingerprints, and other "data" surfaces. Default candidate: **JetBrains Mono** or **iA Writer Mono S**.

Type scale (rem-based, generous line-height):

| Token | Size | Line height | Use |
|---|---|---|---|
| `text-display` | 2.25rem | 1.15 | weekly recap title, onboarding |
| `text-h1` | 1.5rem | 1.25 | section headers |
| `text-h2` | 1.125rem | 1.4 | card titles |
| `text-body` | 1rem | 1.6 | paragraphs |
| `text-meta` | 0.875rem | 1.5 | metadata, captions |
| `text-mono-sm` | 0.8125rem | 1.4 | numeric data |

Letterspacing: tight on display, default on body, slightly loose on mono.

**Rules:**
- No more than two type sizes on a single screen above the fold.
- Body text is `--ambient-fg`. Secondary text is `--ambient-muted`. Never use a third tone.
- Italics are reserved for emphasis and titles of works.
- Never bold a sentence to imitate "highlighting." Use the accent color sparingly instead.

---

## Spacing and layout

Eight-point grid. All spacing values are multiples of 4px (`0.25rem`) with the 8px (`0.5rem`) step preferred. Large blocks use 24, 32, 48, 64.

Content max-width is **640px** for reading surfaces (recap, settings, companion sheet). Dashboard cards live inside a **840px** centered column. Anything wider feels like an admin app, which is wrong here.

The page has **lots of breathing room.** Cards have generous internal padding (24–32px). Sections are separated by 48–64px. The aim is "magazine spread," not "dashboard."

---

## Motion

Motion follows the music. Two principles:

1. **Slow by default.** All transitions ease out over 250–400 ms unless the user is correcting a mistake (e.g., a confirm/cancel sheet snaps in fast and slides out slow).
2. **Synced to BPM where it makes sense.** The morning ritual screen has a single very subtle pulse on the today's pick card — a 1–2% scale breath that matches `--ambient-pulse-ms`. When nothing is playing, the pulse rests.

No bouncy springs. No exaggerated motion. The product should never feel performative.

Use `framer-motion` for layout animations (entering/exiting cards, the companion sheet). Use plain CSS transitions for color and opacity.

---

## Component primitives

We do not use a third-party component library. We build a small set of owned primitives in `lib/ui/`. Each primitive is small, composable, and styled with Tailwind utilities that read ambient tokens.

The starter set:

- `Button` — three variants: `ghost` (default), `accent`, `quiet`. No "primary" / "secondary" labels.
- `Card` — soft surface with optional header and footer. Padding is generous.
- `Sheet` — bottom sheet (mobile) / right rail (desktop) for the Companion and triage.
- `Input` — minimal text input. The capture paste field uses this.
- `Skeleton` — loading states match the ambient palette, no shimmer.
- `Tag` — small rounded label for genres, audio features, watchlist artists.
- `Divider` — hairline using `--ambient-edge`.
- `KeyValue` — a `<dl>`-style row for metadata (track length, BPM, key).
- `MoodBadge` — a tiny visualization of an audio fingerprint (radar mini-chart).
- `Toast` — bottom-aligned, ambient-tinted, auto-dismisses.

**Rule:** any new component goes through review against this list. Most "new components" are recombinations of these primitives.

---

## Iconography

Use **Lucide** icons. Stroke width 1.5. Size matches the surrounding text. Icons are accent-tinted only when they are the primary action; otherwise they use `--ambient-muted`.

No emojis in product UI. Ever.

---

## Imagery

The only images that appear in the product are **album covers**. They are always shown at small sizes (32–96px) with subtle rounded corners (4px) and a 1px ambient-edge border. We never display large hero images of artists or generic stock photography.

The morning ritual screen does not have a hero image. The today's pick is rendered as small album art + track name + reason — quiet, not loud.

---

## Dark mode

Daily Spin has a single mode that adapts via the ambient theme. It is not "light mode" or "dark mode" — it is a soft, paper-toned baseline that drifts warm during the day and cool at night.

A dedicated dark variant may ship in Phase 3 if users ask for one. Until then, "dark mode" is what the theming engine produces when the playing track is dark and low-energy.

---

## Accessibility

- Minimum contrast ratio for body text: 4.5:1 against the background, even when the ambient theme is at its softest. The theming engine clamps the foreground/background pair to enforce this.
- All interactive elements have visible focus states using `--ambient-accent`.
- Motion respects `prefers-reduced-motion`: pulses freeze, transitions become instant.
- Album art is decorative; the visible track name carries the meaning.
- The Companion chat is fully keyboard-navigable.

---

## Reference moodboard (for the AI agent and human reviewers)

Visual references that capture the feeling we are after. Pull the *vibe*, not the literal pixels.

- **Are.na** — typography, calm density, content-first.
- **NTS Radio site** — quiet listings, palette restraint, tasteful asymmetry.
- **Aesop product pages** — generous whitespace, warm neutrals.
- **Rauschenberg's Combines** — color choices that feel both warm and unsentimental.
- **Pitchfork's "Sunday Review" header pages** — editorial tone in a digital frame.

What we are explicitly *not* trying to be: Spotify's UI, Apple Music's UI, Notion's UI, or any "AI app" with neon gradients and chat bubbles.
