# saymynamesaymyname

> A personal growth & relationship companion — built around a timely, AI-drafted check-in loop.
> **Status: planning.** Nothing is built yet. This repo currently holds the living plan.

---

## What this is

A mobile-first app that helps people **show up** — for the relationships they care about
*and* for themselves. At its core it is a **multi-channel, AI-driven check-in engine**:

- It works **standalone for a solo user** (the **growth** pillar — goals, habits, an AI advisor).
- On top of that, it lets you track **any number of relationships** (the **relationships**
  pillar), and proactively nudges you to connect on a cadence you set.
- Journal entries, important dates, moods, memories, and photos are what the loop
  **produces and draws from** — not separate features bolted on.

> **Thesis:** a timely, well-chosen nudge beats a hundred good intentions. The AI removes
> the friction around your warmth — it never replaces it. **Every AI-generated thing is a
> draft; the last word is always yours.**

---

## Core principles (load-bearing — see `SOUL.md` and `PLAN.md`)

- **Inclusive by design (foundational).** Never assumes you're in a relationship. A user
  has **0..N relationships**; each relationship has **1..N members** (supports polyamory /
  non-dyadic structures). **No assumptions about gender, orientation, or shape.** LGBTQA+
  and non-traditional relationships are first-class. Copy is neutral and affirming.
- **You're always in control.** Per check-in: **send / edit / auto / skip**, with
  per-channel defaults *and* a per-check-in override. Nothing is sent behind your back.
- **Private by default.** Personal data stays yours; sharing is opt-in; the AI sees only
  what it needs. Context you upload is treated as **untrusted data, never instructions**.
- **Safety is the floor, not a feature.** The app will **never** enable monitoring,
  tracking, pressuring, or controlling another person. A muted / left / blocked / archived
  member is **unreachable** through the app — enforced in code, not just by the model.
  Crisis signals drop the persona and surface region-correct help.
- **A warm, human voice — the "friendly neighborhood bartender."** Grounded in real
  relationship psychology, but never clinical and **never called therapy**. Honest that
  it's an AI; points to real professionals when something is bigger than a bar conversation.

---

## The check-in loop (the engine)

A six-stage state machine — everything else serves this:

```
Schedule → Trigger → Compose → Deliver → Respond → Reflect
```

- **Schedule / Trigger** — each member sets their own frequency (≈ every 3–12h); a
  tick + due-scan with per-user timezones and an autopilot window.
- **Compose** — the AI drafts the check-in from privacy-filtered context.
- **Deliver** — through the member's chosen channel, gated by a **recipient-reachability**
  check (boundaries are honored before anything sends).
- **Respond / Reflect** — a single fulfilled-state machine with a single-writer guard so
  the user and autopilot can never double-act on the same check-in.

---

## Delivery channels (per-user, configurable, phased)

Push · SMS · Email · WhatsApp · Telegram · Google Calendar · In-app.

---

## The two pillars

| Pillar | Works alone? | What it does |
|---|---|---|
| **Personal growth** | Yes — complete on its own | Goals, habits, personal profiles, an AI advisor, personalization. |
| **Relationships** | Layered on top | 0..N relationships you name & define; shared memories; the check-in loop. |

---

## AI layer

- **Provider abstraction:** **DeepSeek primary, Anthropic fallback**, with a cheap/strong
  (Flash/Pro-style) split, normalized tool-use / vision / streaming, and failover.
- **Centralized system-prompt core** prepended to *every* call — it enforces the inclusive
  invariants (mirror the user's own names, pronouns, and labels; never guess) and the
  safety guardrails.
- **Context-builder** assembles a privacy-filtered view per call; uploaded docs/images
  (OCR'd) become citable context, tagged as data.
- **Graceful degradation:** if the API is down, the bartender simply says so
  ("the bar's closed…") rather than failing silently.

---

## Tech (provisional — some decisions still open)

| Layer | Direction |
|---|---|
| Client | Mobile-first. **Open decision:** Capacitor (max reuse of our sibling codebase) vs. Expo/RN. |
| Backend / DB | **Supabase** (Postgres, Auth, Storage) — a server DB is required because shared relationships sync across members/devices. |
| Scheduling | Supabase `pg_cron` + Edge Functions (tick + due-scan). |
| AI | DeepSeek (primary) + Anthropic (fallback); Mistral / Claude vision for OCR. |
| Localization | Static UI via i18n; dynamic AI content generated per-recipient (no machine translation); RTL-aware; localized crisis resources. |

This app is the third in a family — **PLT (legal) → SchedaPRO (fitness) → this
(relationships)** — that recycles infrastructure and swaps the domain. Reuse candidates
and the domain mapping live in `PLAN.md` §13.

---

## Repo contents

| File | Purpose |
|---|---|
| `PLAN.md` | The full living plan — idea, check-in loop, data model, roadmap, crons, AI usage, localization, **guardrails (§12)**, and reuse notes. **Start here.** |
| `SOUL.md` | Why the product exists — mission, thesis, who it's for, what it is *not*, and the smell tests every feature must pass. |
| `CLAUDE.md` | Working guidance & living source of truth for project context. |
| `LICENSE` | MIT. |

> Not committed here: the sibling codebase (`schedapro/`, its own repo) and a personal
> photo, both intentionally excluded — see `.gitignore`.

---

## Roadmap (phased)

- **Phase 0** — solo growth + relationships scaffolding (accounts, invite, data model).
- **Phase 1** — the minimal AI check-in loop end-to-end.
- **Phase 2** — memories, the advisor, bartender tools.
- **Phase 3** — additional delivery channels.
- **Phase 4** — smarter scheduling & personalization.

---

## License

MIT © 2026 — see [`LICENSE`](./LICENSE).
