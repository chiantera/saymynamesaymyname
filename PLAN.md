# PLAN.md — Relationship app

Living plan. Status: **planning**. Nothing built yet.
North star: **the check-in loop**. Build the full vision in **phases**.

---

## 1. The idea in one sentence

A personal app that helps you **grow** (goals, habits, an AI advisor) and, **for any
relationships you choose to track**, **proactively prompts you to connect** on a
cadence you set — quietly accumulating a record (messages, moods, memories, photos)
as a byproduct.

The check-in loop is the engine. Two pillars sit on it: **personal growth** (goals,
habits, profiles, advisor — §3c) which works on its own, and **relationships**
(check-ins, shared memories) layered on top for those who want them. Journal, dates,
and photos are what the loop produces and draws from — not separate features bolted on.

## 1a. Core assumptions — inclusive by design (FOUNDATIONAL)

These shape the entire data model and copy. Non-negotiable:

- **No assumption the user is in a relationship.** A solo user is a first-class,
  complete experience — the growth pillar (§3c) stands fully on its own.
- **Any number of relationships.** Zero, one, or many. A user belongs to 0..N
  relationships; the app never implies they should have exactly one.
- **Relationships aren't only two people.** A relationship has the user plus **one or
  more** others (supports polyamory / non-dyadic structures). No "the two of you."
- **No assumptions about gender, orientation, or relationship structure.** LGBTQA+
  and non-traditional relationships are fully supported. Copy is **neutral and
  affirming**; no gendered defaults, no heteronormative framing.
- **The user names and defines each relationship** (label, who's in it, type). The app
  adapts to them, never the reverse.

> Terminology in this doc: "**relationship**" = a tracked connection (1..N other
> people); "**member**" = a person in it; "**partner**" used loosely = another member,
> not a presumption of romantic/dyadic structure. Earlier sections may still say
> "couple/two partners" — read those as shorthand for "a relationship and its members"
> and treat §1a as authoritative.

---

## 2. The check-in loop (the core — design in depth)

A "check-in" = a prompt delivered to the user on their cadence, inviting a small
act of connection (with another member of a relationship, or with themselves for
growth). The loop has six stages:

```
  (1) SCHEDULE → (2) TRIGGER → (3) COMPOSE → (4) DELIVER → (5) RESPOND → (6) REFLECT
        ▲                                                                     │
        └─────────────────────── adapt cadence / streak ─────────────────────┘
```

1. **Schedule** — each user has: cadence (every 3–12h), quiet hours, timezone,
   preferred channels. This defines *when* and *where* they can be pinged.
2. **Trigger** — a cron tick finds users who are "due" (now ≥ last_sent + cadence,
   and inside their waking hours).
3. **Compose** — an **AI** decides what the check-in *says* and which of the four
   intents it serves this time (reach out / log state / small gesture / resurface a
   memory). It reads the relevant recent context (entries, moods, upcoming dates,
   what was sent recently, what landed) and writes a tailored prompt. See §2b.
4. **Deliver** — send via the user's channel(s): push / in-app / SMS / email /
   WhatsApp / Telegram, and/or drop an event on Google Calendar.
5. **Respond** — the user acts: opens the app and writes, taps "done", or (on
   two-way channels) **replies inline** — that reply becomes a journal entry / a
   message to a relationship member.
6. **Reflect** — other members see **only the resulting content** (a message you sent,
   an entry you shared) — never your check-in *activity* (that a prompt fired, was
   edited, skipped, or ignored stays private to you). Streaks/stats update and the
   system learns (answered? ignored? → adapt cadence, avoid fatigue).

### Design principles for the loop
- **Respect quiet hours.** Never ping while asleep; defer to the next window.
- **Fight fatigue.** If prompts are repeatedly ignored, back off the cadence and
  surface a gentle "want to change how often we check in?" rather than nagging.
- **Two-way where possible.** SMS/WhatsApp/Telegram replies should flow back in via
  inbound webhooks so the user never *has* to open the app to participate.
- **Idempotent sends.** A given scheduled check-in is sent exactly once even if a
  cron tick retries. Track per-send state.
- **Per-user timing inside one tick.** The cron runs frequently (e.g. every 15 min);
  each run computes *who is individually due*, rather than one global schedule.
- **Meaning over volume.** Better one prompt that lands than six that annoy.

### Completion model — one source of truth (DECIDED)

"Completing" a check-in must mean **the intended act happened exactly once**, no
matter who caused it — the **user** (approve / edit / send / log mood) or the **app**
(autopilot default fires). To guarantee the user and the app never diverge or
double-act, each check-in is a **state machine with a single terminal `fulfilled`
state**:

```
pending ──user acts──▶ fulfilled(by=user)
   │                        ▲
   └──window elapses────────┘  fulfilled(by=app/default)
```

- **Single-writer guard**: closing a check-in is an atomic transition. Whoever gets
  there first (user tap *or* the window-expiry job) wins; the other path sees it's no
  longer `pending` and does nothing. This is the idempotency point — prevents the
  duplicate-send / "app and user both acted" problem.
- **What "fulfilled" means by intent**: outward (message a member) → exactly one
  message sent and recorded; inward (log mood) → the user logged once; gesture →
  marked done. One check-in → at most one resulting artifact.
- **Acted outside the app** (e.g. you just texted them directly): the app can't always
  know. Provide a one-tap "already did this" to close the loop; two-way channel
  replies also auto-close it. Otherwise it lapses per the window default.

### Open questions for the loop (still to decide)
- Is a check-in directed *at another member* or *inward*, or both — and does the AI
  choose, or rotate? (Leaning: AI chooses, since AI drives composition.)

---

## 2b. The AI layer (the brain of the loop)

Decision: the app is **AI-composed from v1**. The AI is not a prompt picker — it is
a relationship assistant that **generates the check-ins, reminders, and content**,
choosing intent and wording from the user's living context.

**Engine**: Claude API (see the `claude-api` skill when we build this).

**What the AI does**
- Decides *which intent* a given check-in serves (reach out / log state / gesture /
  resurface memory) based on recency, balance, and what's landed lately.
- Writes the prompt/message text in a warm, personal voice using the relevant member's name
  and real context (recent moods, upcoming dates, a past photo/entry to resurface).
- Drafts reminders and digest/recap copy.
- Adapts over time: avoids repetition, respects what gets ignored vs. engaged.

**Context the AI reads (the "memory" of the relationship)**
- Recent journal entries + moods, upcoming/important dates, recent check-ins and
  their outcomes, basic profile (names, tone preference, timezone), **user-uploaded
  context sources (docs + OCR'd images)**, and the user's/relationship's **goals/personalization
  (§3c)**. All scoped to the space. A compact **context-builder** assembles the
  relevant slice per call (for both check-in composition and the advisor chat).

**Guardrails (must-haves)**
- **Authenticity / consent — DECIDED: per-check-in choice.** Each time the AI
  generates something, the user chooses *that instance's* fate: **send as-is**,
  **edit then send**, **send automatically (autopilot)**, or **skip**. No global
  "AI always speaks for me" switch — control is exercised every time.
  - **DECIDED — fully configurable, two levels:**
    1. **Per-channel defaults** (set once, editable): each channel has a default
       *action* (auto-send / skip) and a default *window* length. These fire when
       the user doesn't intervene on a given check-in.
    2. **Per-check-in override**: when a check-in is generated the user can set
       *that instance's* action and window, overriding the channel default.
    So nothing is globally locked — there's always a sensible fallback (the channel
    default) AND always the ability to choose each time.
  - *Implication*: `channels` stores `default_action` + `default_window` per channel;
    `checkins` stores the resolved `decision`, `decision_deadline`, and whether it was
    an override or the channel default. UI must make per-check-in choice fast (one-tap
    presets) so configurability never becomes a chore.
- **Tone safety**: never trivialize conflict; sensitive moods → gentler, optional prompts.
- **Privacy**: AI only sees the relevant relationship's data; never leak one member's
  private notes to others.
- **Fallback**: if the AI call fails, fall back to a small curated prompt set so the
  heartbeat never stops.

---

## 2c. Context, chat & the advisor ("the bartender")

Beyond scheduled check-ins, the app is a place to **bring context, talk it through,
and get advice**. Three connected capabilities:

**1. Share context (documents + images/OCR)**
- The user can upload **documents** and **images/screenshots** (e.g. a screenshot of
  a tense text exchange). Images run through **OCR** to extract text.
- Extracted text + files become **context sources** the AI can draw on — both in the
  advisor chat and when composing check-ins.
- Tech (tentative): OCR via a vision model (Claude vision can read screenshots
  directly) or a dedicated OCR step; store originals in Supabase Storage, extracted
  text + metadata in the DB.

**2. Chat about the context**
- A conversational surface where the user talks with the AI about what's going on,
  referencing uploaded context and the relationship history. Persistent threads.

**3. Relationship advice — the "friendly neighborhood bartender" persona**
- **In-app, it's just a warm, easy-to-talk-to bartender.** That's the persona: casual,
  non-judgmental, a good listener who asks the right question and offers a steadying
  perspective. We never label it as therapy or a psychologist in the product.
- **Default behavior**: a balance of *nudging* and *listening*, peppered with
  one-liners — **user-tunable** via AI personalization (§3c-D).
- **Spoken voice (DECIDED — text-first, TTS optional/later)**: the advisor is **text
  by default**. Audio is an optional layer added after v1:
  - *Free toggle*: device-native TTS (`expo-speech`) — works offline, generic voice.
  - *Premium*: cloud AI TTS (e.g. ElevenLabs-style) for a natural, consistent
    bartender voice — a candidate paid-tier feature.
  - A fixed pre-recorded voice is ruled out: it can't speak dynamically generated text.
- **Under the hood**, its guidance is grounded in real relationship-psychology
  principles so the advice is actually sound — but that framing stays internal.
- **API-down / degraded behavior (DECIDED)**: the advisor must **never fake a canned
  conversation**. If the Claude API is unavailable, it breaks character gracefully —
  *in the bartender's voice* — with a short notice instead of a reply, e.g.:
  > "The bar's closed — the API's down. Check back soon. Email [support address] if
  > it keeps up. Thanks, and drive safe."
  - Placeholder `[support address]` = a real support/contact email (TBD).
  - This notice is **static and localized** (§10) so it works even with no API.
  - Distinct from the **check-in heartbeat**, which *can* still fire pre-written
    nudges from the fallback library (§2b) — only the interactive advisor shows the
    "bar's closed" notice, since a conversation can't be faked from static text.
- **Safety guardrails (non-negotiable)**: it is *not* a licensed therapist and must
  never claim to be. For signs of crisis, abuse, or self-harm it drops the act and
  responds responsibly — encourage real help / surface appropriate resources. Avoid
  clinical diagnosis. This protects users and us; bake it into the system prompt.

## 3c. Goals & Growth (the second pillar)

The app has **two pillars** that share one engine:
1. **Personal growth** — a full growth experience (think Finch / Fabulous / Stoic)
   that works **standalone for a solo user**. This is the base layer.
2. **Relationships** — check-in loop, shared memories, the advisor — layered on for
   **any relationships the user chooses to track** (0..N, each with 1..N members).

This area is where intentions live, and it feeds everything: the AI uses it to
compose better check-ins and give better advice. Four parts, across **shared and
private** scopes:

**A. Relationship goals (shared, per relationship)**
- The members of a relationship agree on goals: *more quality time, less conflict,
  plan a trip, weekly date night*. Each goal can have milestones, a target, and
  progress. Exists only when the user is tracking a relationship.

**B. Personal growth goals (per-person; private by default, shareable)**
- The user sets their own: *be more patient, listen better, manage stress*. **Works
  for solo users** with no relationship at all.
- Growth-app mechanics: habits, streaks, check-ins, milestones, reflections,
  progress over time. These **ride the existing cron/nudge engine** — a growth nudge
  is just another scheduled prompt on the same rails as relationship check-ins.

**C. Personal profiles (per-person)**
- Traits, **love language**, communication style, triggers, preferences, what helps
  when stressed. Drives more tailored advice and check-ins. Sensitive — respect the
  privacy model (a member sees only what others choose to share).

**D. AI personalization (per-person)**
- Tune the bartender: tone, directness, humor, how much it nudges vs. listens.
- Each user can experience a differently-voiced AI.

**Scope rule**: every goal/profile item is tagged **shared** (other members of the
relevant relationship see it) or **private** (only you + the AI). The AI always
respects this when composing for or advising any other member. Reuses the same
visibility model as §3 entries.

## 3. Supporting features (serve the loop)

- **Relationships** — the user defines 0..N relationships, each with 1..N members,
  optionally inviting them via link; all relationship data is scoped per-relationship.
- **Journal / notes** — entries (text, mood, date). Many entries are *generated by*
  check-in responses; can also be created manually.
- **Important dates** — anniversaries/birthdays/milestones; feed reminder crons and
  give the compose step material ("Your anniversary is in 7 days — plan something?").
- **Photos & media** — attach to entries or stand alone; surfaced in digests/recaps.

---

## 4. Crons / scheduled jobs

| Job | Cadence | Purpose |
|---|---|---|
| **Check-in dispatch** | frequent tick (~15 min); per-user 3–12h | the core loop |
| Date reminders | daily scan | notify ahead of anniversaries/dates (7d/1d/day-of) |
| Daily digest | morning, per timezone | upcoming dates + a resurfaced memory |
| Weekly recap | weekly | the week's entries, moods, photos |
| Streak check | daily | nudge if the space has gone quiet |

Scheduling tech (tentative): Supabase **pg_cron** triggers an **Edge Function**
dispatcher that resolves who is due and fans out to channel senders. Revisit if a
dedicated queue/worker is needed for reliability at scale.

---

## 5. Data model (first sketch — will evolve)

- **users** — auth identity, display name, timezone, **locale/language**. A user can
  exist with **zero** relationships (solo growth experience).
- **relationships** — a tracked connection the user defines: label, type (chosen by
  the user), created_by, **status (active|archived)**. Has **1..N member**s (not fixed
  at 2). A user has **0..N**. Archiving stops check-ins but preserves all data (§11).
  (formerly "spaces")
- **relationship_members** — user ↔ relationship link, role/label, **status
  (active|muted|left|blocked)**. N rows per relationship; supports non-dyadic
  (polyamorous) structures. Send tools/autopilot **must check status** — muted/left/
  blocked members are unreachable in code, no AI override (§12-C).
- **invites** — token, relationship, expiry, status. Inviting others is **optional** —
  a relationship can be solo-tracked (members not on the app) or shared.
- **checkin_prefs** — **per user per relationship**: cadence_hours, quiet_hours,
  enabled_channels. (Each relationship can have its own cadence; quiet hours may also
  be a user-global default.) Growth-only/solo users may have prefs with no relationship.
- **channels** — per user connected destinations: push tokens, phone, email,
  telegram_chat_id, whatsapp number, google_calendar auth. Also per-channel
  **default_action** (auto-send/skip) and **default_window** for the approval flow.
- **checkins** — scheduled/sent instances: **relationship_id (nullable — null = a
  solo/growth check-in)**, due_at, sent_at, channel, status, intent, generated_text,
  response, outcome (engaged/ignored), decision (pending/approved/edited/auto/skipped),
  decision_deadline. (idempotency, per-check-in approval flow, and the AI's feedback
  signal for reflect/adapt)
- **prompts** — small **fallback** library used only if the AI call fails.
  (Rich per-person context lives in `growth_profiles` / `ai_personalization` below.)
- **entries** — journal entries (text, mood, created_by, source: manual|checkin,
  **visibility: shared|private — default private, sharing is opt-in**). Check-in
  *activity* never lives here — only artifacts the user chose to surface.
- **important_dates** — title, date, recurrence, reminder offsets.
- **media** — storage refs, optional link to an entry.
- **context_sources** — uploaded docs/images: storage ref, type, **ocr_text**,
  extracted metadata, added_by. Feeds the context-builder.
- **conversations** / **messages** — advisor ("bartender") chat threads and turns.
- **goals** — relationship + personal-growth goals: scope (shared|private),
  owner, **relationship_id (nullable — null = solo/personal goal)**, type
  (relationship|growth), target, status, visibility. (§3c-A/B)
- **goal_progress** — milestones, habit ticks, streaks, progress events per goal.
- **growth_profiles** — per-person traits, love language, comm style, triggers,
  preferences; each field tagged shared|private. (§3c-C)
- **ai_personalization** — per-person voice/behavior settings for the bartender. (§3c-D)
- **crisis_resources** — per country/region: **emergency number**, crisis/suicide &
  DV hotlines, and links — source for the localized safety guardrail + persona-drop
  message (§10.6, §12). Professionally verified.
- **change_log** — audit of AI-initiated (bartender tool) changes: actor, tool, before/
  after, timestamp; powers "here's what I changed" + undo (§11).

---

## 6. Phased roadmap (plan-all, build-in-phases)

- **Phase 0 — Foundations**: Expo app shell + Supabase project, auth, solo user
  onboarding, and the ability to **create 0..N relationships** (1..N members) and
  optionally invite others. No loop yet — just users, relationships, membership.
- **Phase 1 — The AI loop, minimal**: check-in prefs (per-relationship cadence +
  quiet hours), cron dispatcher, **push + in-app** delivery, **AI compose** (Claude)
  with a context-builder + fallback library, capture responses as entries, basic
  streak. Works for both solo (growth) and relationship check-ins.
  *This is the heartbeat — get the AI prompts genuinely good first.*
- **Phase 2 — Memories + advisor**: full journal, important dates + reminder cron,
  photos. Daily digest. **Advisor chat ("bartender")** + **context upload (docs +
  image OCR)** + **Goals/personalization area (§3c)** — these enrich the AI's context.
  Introduce **bartender tools** (§11): read tools + low-risk writes (cadence,
  personalization) first, expanding later.
- **Phase 3 — More channels**: Email, then Telegram (easy two-way), then SMS &
  WhatsApp (Twilio), then Google Calendar. Add inbound reply handling per channel.
- **Phase 4 — Smarter loop**: fatigue-aware adaptive cadence, weekly recap, richer
  stats, deeper personalization, possibly AI acting more autonomously for the user.

Each phase ends with something usable — solo first, then with any relationships added.

---

## 7. Cross-cutting decisions still open

- **AI authenticity/consent** — *resolved*: per-check-in choice (send/edit/auto/skip),
  with per-channel default action + window as the fallback, and per-check-in override
  of both. Nothing further blocking; refine preset values during Phase 1 build.
- AI tone/voice — *resolved*: bartender persona, default nudge/listen + one-liners,
  user-tunable; text-first with optional TTS later (see §2c).
- Claude API cost/rate limits given frequent per-user check-ins; caching/batching. → §9
- Privacy model — *resolved*: members see only **resulting content**, not each
  other's check-in activity. Check-ins, decisions, and prompt history are **per-user
  private**. **Journal entries default to private; sharing is opt-in.** A private
  entry stays unseen by other members. A relationship holds only what each chose to surface.
- Third-party accounts/costs: Twilio (SMS+WhatsApp), Resend (email), Telegram bot,
  Google Cloud (Calendar + push). Which are acceptable, and when.
- Delivery reliability strategy (retries, idempotency, timezone correctness). → §8
- Whether a hosted backend other than Supabase is preferred for any piece. → §8

---

## 8. Scheduling & reliability architecture (the engine)

This is the riskiest part — the whole app's value depends on check-ins firing at the
right time, once, on the right channel. Design goals: **timezone-correct**,
**exactly-once**, **survives retries**, **respects quiet hours**, handles the
**autopilot decision-window**.

**Core pattern — frequent tick + due-scan (start here)**
- A `pg_cron` job runs the **dispatcher** every ~5–15 min.
- Each run computes, in SQL, the set of users who are **due now**:
  `now() >= last_checkin_at + cadence` AND `now()` is inside their waking window
  (converted to the user's timezone) AND no `pending` check-in already open.
- For each due user it **inserts a `checkins` row in one atomic step** (unique
  constraint on `(user_id, due_slot)` → idempotency: a retry can't double-insert).
- The dispatcher then composes (Claude, §9) and either auto-sends or presents for
  approval per the channel default.

**Autopilot decision-window**
- When a check-in is generated it gets a `decision_deadline = now() + window`.
- The same tick scans for `pending` check-ins whose deadline has passed and applies
  the channel default (auto-send or skip) via the **single-writer transition** (§2 —
  whoever closes it first wins, so user-tap and the expiry job never both fire).

**Delivery reliability**
- **Recipient-reachability gate (safety)**: before any outbound send to another member,
  check `relationship_members.status` and relationship `status` — **muted/left/blocked/
  archived → do not send** (§12-C). Enforced here in code; no AI/autopilot path bypasses it.
- Each send is an idempotent op keyed by `checkin_id + channel`; a send is only marked
  `fulfilled` after the provider confirms. Failed sends → bounded **retry with
  backoff**; exhausted retries → fall back to in-app + log.
- Provider webhooks (delivery receipts, inbound replies) update status and can
  auto-close the loop.

**Timezones & quiet hours**
- Store each user's IANA timezone; do all "is it daytime / is it due" math in their
  local time. Quiet-hours violations defer to the next open window, never drop.

**Resilient background jobs (from SchedaPRO `analysisManager.ts`)**
- Long AI work (composition, digests, recaps) runs as **background jobs that survive
  navigation, phone lock, and refresh**: kick off → poll → resume → merge, with a
  **non-blocking progress indicator** and abort. Reuse this proven client-side pattern
  so the app never freezes waiting on the model; pairs with provider failover (§9a).

**When to graduate beyond the tick**
- The tick+scan is simple and fine for a small user base. If we need precise per-second
  timing, heavy fan-out, or robust retries at scale, introduce a **job queue**
  (Supabase `pgmq`, or an external scheduler like Inngest / Trigger.dev / QStash) where
  each check-in is an individually scheduled, retryable job. *Decision deferred —
  start with tick+scan, keep the dispatcher logic queue-agnostic so we can swap later.*

**Backend**: Supabase confirmed for Postgres/Auth/Storage/pg_cron/Edge Functions.
Revisit only if a specific piece (e.g. long-running AI jobs) needs a dedicated worker.

---

## 9. AI usage & cost architecture (the brain)

The AI runs on **every** check-in and every advisor turn, so design for **quality,
latency, and cost** from the start. Default engine: **Claude API** (use the
`claude-api` skill when building) — but **behind a provider-abstraction layer** so we
are not locked to one vendor (§9a).

### 9a. Provider abstraction (no vendor lock-in — DECIDED)

All model access goes through **one internal interface**, never a direct SDK call from
feature code. Adapters implement it per provider (Anthropic default; OpenAI, Google,
open/self-hosted models, etc.).

- **Normalized capabilities**: chat/completion, **tool use**, **vision** (for OCR/
  screenshots, §10.5), streaming. The adapter maps our canonical request to each
  provider's format — *tool-calling and message schemas differ across vendors*, so the
  abstraction must normalize them.
- **Config-driven routing**: pick provider/model per task (cheap/fast for routine
  check-ins, stronger for advisor) and per region/compliance need — swappable without
  touching feature code.
- **Default routing (from the SchedaPRO sibling, proven)**: **DeepSeek primary** (cheap
  "Flash" tier for routine, high-volume check-in composition → answers our cost worry),
  **Anthropic fallback** and for the nuanced advisor / sensitive turns (a "Pro" tier).
  The cheap/strong split mirrors SchedaPRO's Flash/Pro policy; the stronger tier gates
  on the same explicit-confirmation stance as our consent model (§2/§11).
- **Failover (ties to reliability below)**: on a provider error/timeout, **route to a
  fallback provider** before giving up. Only when *all* providers fail do we show the
  static "bar's closed" / fallback-library path (§2c/§2b).
- **Guardrails are provider-agnostic**: the centralized system-prompt core +
  inclusivity/safety invariants (§9, §12) apply to **every** adapter; the eval/red-team
  suite (§12) runs **per provider** so swapping a model can't silently weaken safety.
- **Separate model families** for non-text too: TTS (device/ElevenLabs/other, §2c) and
  OCR/vision sit behind their own adapters — also non-Anthropic-swappable.
- Watch per-provider differences in prompt-caching, token limits, and pricing in the
  cost controls below.

**Context-builder** (one place, reused by check-ins + advisor)
- Assembles a compact, **privacy-filtered** context slice per call: profile + goals
  (respecting shared/private), recent moods/entries the user owns or that are shared,
  upcoming dates, recent check-in outcomes, and relevant uploaded context sources.
- Hard token budget; summarize/trim oldest material rather than dumping everything.

**Cost & latency controls**
- **Prompt caching** for the stable system prompt + persona + slowly-changing profile
  → big savings since these repeat across calls.
- **Right-size models**: a smaller/faster Claude model for routine check-in composition;
  a stronger model for the advisor chat and nuanced situations.
- **Don't call when not needed**: skip composition for users in quiet hours or with no
  open slot; reuse a recent generation if context hasn't changed.
- Batch non-urgent generation (e.g. digests) where latency doesn't matter.

**Reliability (failover, then two fallback modes)**
- **First, provider failover** (§9a): on a provider error/timeout, retry via a fallback
  provider. The static modes below trigger only when **all providers** are unavailable.
- **Check-in heartbeat**: backed by the **fallback prompt library** (§2b) — pre-written,
  localized nudges so scheduled check-ins keep firing even when every provider is down.
  Timeouts → failover → fallback, log, move on.
- **Interactive advisor**: a conversation *can't* be faked from static text, so when all
  providers fail it shows the static, localized **"bar's closed" notice** (§2c) instead
  of a reply — break character gracefully, never stall or hallucinate offline.

**Safety & inclusivity (baked into every prompt)**
- One **centralized system-prompt core** is prepended to **every** AI call — check-in
  composition, advisor chat, digests, recaps — so these rules are defined once and
  inherited everywhere (no prompt can opt out):
  - **Inclusivity invariants (§1a)**: never assume the user is in a relationship,
    never assume number of members, never assume gender / orientation / relationship
    structure. Use neutral, affirming language; mirror the user's own terms (names,
    labels, pronouns) rather than guessing. Affirm LGBTQA+ and non-dyadic relationships.
  - **Safety guardrails (§2c)**: bartender persona; not a therapist and never claims
    to be; crisis/abuse/self-harm → drop the act, respond responsibly, surface real
    help; no clinical diagnosis.
- The context-builder supplies the *facts* (who the members are, pronouns, labels) so
  the model personalizes from real data instead of assumptions.
- Add this to an eval/checklist: prompts should be tested against solo users, same-sex
  relationships, polyamorous structures, and no-relationship states to confirm the
  output never regresses to heteronormative or couple-centric defaults.

---

## 10. Localization & internationalization (i18n / l10n)

This app is **harder than usual** to localize because most of its content is **AI-
generated**, delivered across **many channels**, and includes **safety-critical**
copy. Two distinct streams: **static UI** (translation files) and **dynamic AI text**
(generated directly in the user's language). Plan for both from the start — retrofitting
i18n is expensive.

**Locale model**
- Each user has a **language/locale** preference (default from device via
  `expo-localization`, user-overridable) plus their IANA timezone (already in §8).
- In a relationship, **each member may use a different language.** Consequence: a
  check-in/message is generated **per recipient, in that recipient's language** — not
  once for the whole relationship. The advisor speaks each user's own language.

**1. Static UI (i18n framework)**
- Use a standard library (e.g. `i18next` / `react-i18next`, or `lingui`) with locale
  JSON catalogs. No hardcoded strings; all copy via keys.
- Handle **plurals**, interpolation, and **date/number/relative-time** formatting via
  `Intl` (e.g. "in 3 hours", anniversaries) — these are core to the scheduling UX.
- **RTL support** (Arabic, Hebrew, Farsi): mirror layouts; test early, since RTL bugs
  are pervasive if added late.

**2. Dynamic AI content (the unusual part)**
- The **system-prompt core (§9)** gains an instruction: *respond in the recipient's
  locale* (passed as a fact from the context-builder). Claude is multilingual, so
  content is generated natively in-language — **no post-hoc machine translation** of
  AI text (which would lose nuance and the bartender's voice).
- **Mirror the user's own language/terms** — ties into §1a inclusivity (pronouns,
  relationship labels differ across languages; grammatical gender must follow the
  user's stated terms, not assumptions).
- The **fallback prompt library (§2b)** must itself be localized (it's static text), so
  the heartbeat still speaks the user's language when the API is down.

**3. Channels**
- Push / SMS / email / WhatsApp / Telegram / calendar content all rendered in the
  recipient's locale. Watch SMS encoding (non-Latin scripts → UCS-2, fewer chars/segment).

**4. Voice / TTS (§2c)**
- TTS voice must match the content language; device-native and cloud-TTS voice
  selection keys off the user's locale.

**5. OCR / uploaded context (§2c)**
- Screenshots/docs may be in **any language/script**; vision/OCR must handle
  multilingual input. The AI can read and reason across languages natively.

**6. Safety-critical localization (non-negotiable)**
- **Crisis/abuse/self-harm resources are region-specific** (hotline numbers differ per
  country). Maintain a per-country resource table; the safety guardrail (§9) must
  surface the **right resources for the user's region/locale**, not a US default. Get
  these professionally verified.

**7. Cultural sensitivity**
- Relationship norms and humor vary by culture; the bartender persona may need light
  cultural adaptation, and the inclusivity stance must hold across locales (some
  markets are less LGBTQA+-friendly — we stay affirming regardless, while being mindful
  of user safety in hostile regions).

**Data-model touches**
- `users.locale`; localize the **fallback `prompts`** library and any seeded content;
  add a **`crisis_resources`** table keyed by country/region.

**Phasing**
- **Build i18n-ready from Phase 0** (framework, no hardcoded strings, locale plumbing)
  even if we **ship one language first**. Add the AI "respond in locale" instruction in
  Phase 1. Expand languages, RTL, and localized crisis resources as we roll out regions.

**Who translates what, and when (workflow — DECIDED)**
Translation responsibility splits by content type:
- **AI-generated content** (check-ins, advisor replies, digests, recaps): **nobody
  translates it — Claude writes it natively in the recipient's locale at runtime** (§9).
  No translator, no pipeline, no lag. This is the bulk of what users read.
- **Static UI strings** (buttons, labels, onboarding, settings): extracted to locale
  catalogs.
  - *Launch language*: written in-house as we build (source of truth).
  - *Additional languages*: managed in a **TMS (Crowdin or Lokalise)**; produce an
    **AI-assisted draft translation, then human review** by a native speaker before
    release. Added **per-region as we roll out**, not all up front.
- **Safety-critical & legal copy** (the "bar's closed" notice, crisis resources,
  consent/privacy, disclaimers, store listings): **professional human translation +
  verification — never machine-only.** A new language does **not ship** until its
  safety/crisis copy is professionally verified (gating requirement).
- **Crisis resources** (§10.6): sourced/verified **per country** by a qualified
  reviewer, not translated generically.

*Timing*: i18n plumbing from Phase 0 → ship one language → each added language goes
through TMS draft+review for UI and **professional review for safety copy** before
that locale is enabled.

**Open decisions**
- Launch language(s) and the next tier to add.
- Whether to support RTL at launch or fast-follow.
- TMS choice (Crowdin vs. Lokalise) and who owns native-speaker review per language.

---

## 11. Bartender tools — conversational configuration (DECIDED: yes, with guardrails)

The bartender gets **tools (Claude tool use / function calling)** so the user can
configure the app **by talking**: *"check in with me less often"*, *"be more direct
with me"*, *"send reminders to Telegram instead"*, *"add an anniversary on June 3"*,
*"what are my goals?"*. This makes a deep, settings-heavy app discoverable through
conversation, and lets the bartender **tune itself** (the personalization loop).

**Tool catalog (all scoped to the current user; same validated app logic as the UI)**
- *Read*: get check-in prefs, channels, goals, profile, upcoming dates, personalization.
- *Write*: set cadence / quiet hours; enable/disable a channel & its default action+window
  (§2b); update AI personalization (tone/directness/humor); create/update goals &
  progress (§3c); add/edit important dates; update profile fields; set locale (§10).
- *Relationship*: create a relationship, invite a member, adjust a relationship's
  settings, **archive a relationship** — **higher-sensitivity**, see confirmation rules.
  - **Archive** is the graceful, **reversible** end-state: stops active check-ins and
    hides it from the active list, but **preserves all memories/entries/photos**.
    Distinct from delete (hard, irreversible). Relationships *end* — the app must
    handle that with care, not force a destructive choice. Unarchiving restores it.

**Control & confirmation model (consistent with the per-check-in consent stance)**
- **Reads**: free, no confirmation.
- **Routine writes** (cadence, tone, channel toggle, add a date): apply, then **show
  a clear "here's what I changed" with one-tap undo**. Optional "always apply changes
  like this without asking" so power users can go faster.
- **Sensitive but reversible** (archive a relationship, delete a goal): **confirm
  before acting**, but recovery is easy (unarchive / restore from `change_log`).
- **Sensitive / irreversible** (hard-delete a relationship, invite someone, disconnect
  a channel, change locale): **always confirm before acting** — no silent execution.
- Every AI-initiated change is **logged/auditable** so the user can see and revert what
  the bartender did. Nothing the bartender can do is unrecoverable without a confirm.

**Hard boundaries (NOT given to the bartender)**
- Account deletion, auth/password changes, billing/payments, anything legal/financial.
- It can never **read another member's private data** to satisfy a request (privacy
  model §2/§3c) or act on another user's account — tools are single-user-scoped and
  RLS-enforced server-side.

**Implementation notes**
- Tools execute in the **Edge Function** against Supabase **with the user's auth so RLS
  applies** — the model proposes a call, the backend validates inputs and executes;
  the model never touches the DB directly. Validate/whitelist every argument.
- Tool definitions + the confirmation policy live alongside the centralized system
  prompt (§9), so safety/inclusivity invariants always wrap tool use too.

**Phasing**: introduce after the advisor exists (Phase 2) — start with a few
**read** tools + low-risk **writes** (cadence, personalization), then expand. Tools
also keep working in the user's language (§10).

---

## 12. Guardrails & Trust/Safety (consolidated — the safety backbone)

This app gives emotional advice, stores sensitive relationship data, sends messages on
many channels, and lets an AI take actions via tools. That is a **high-risk surface**.
Guardrails are a **first-class system**, not scattered notes. Defense in depth across
five layers, plus special-case handling and process. (Supersedes/centralizes the
safety bullets in §2c/§9/§11.)

### Layer 1 — Input guardrails (what comes in)
- **Untrusted content is data, never instructions.** OCR'd screenshots, uploaded docs,
  inbound channel replies, and another member's messages are **untrusted** and must be
  clearly delimited in the prompt. The model is instructed to **treat them as content
  to reason about, not commands to obey** — core **prompt-injection** defense, critical
  now that the bartender has tools. Tool calls are never triggered by text inside
  uploaded/inbound content.
- **Classify each advisor turn** for risk (self-harm, abuse/DV, violence, minors,
  medical/legal/financial, harassment) before composing a normal reply.

### Layer 2 — Generation guardrails (what the AI says)
- Centralized system-prompt core (§9) carries **inclusivity (§1a)** + **safety**
  invariants on every call.
- **Scope discipline**: not a therapist/doctor/lawyer/financial advisor; no diagnosis;
  steer to professionals for out-of-scope needs. Never claims to be human or licensed;
  if asked, is honest that it's an AI. ("Bartender" is a persona, not a deception about
  being a professional.)
- No content that manipulates, shames, or coerces the user or a member.

### Layer 3 — Misuse & abuse guardrails (THIS app's biggest risk)
- **Coercive control / surveillance refusal**: the app must never become a tool to
  **monitor, track, pressure, manipulate, isolate, or harass** another person. The AI
  refuses requests like "help me check if they're lying / guilt-trip them / make them
  reply / track them" and gently reframes toward healthy communication.
- **Abuse-aware**: if a user appears to be **experiencing** abuse, prioritize their
  safety and surface localized DV resources (§10.6); if a user appears to be
  **perpetrating** control/abuse, do not assist and do not coach manipulation.
- **No auto-send weaponization**: autopilot (§2b) can't be used to spam/harass a member;
  rate-limit and respect a member's ability to mute/limit inbound.

### Layer 4 — Action/tool guardrails (what the AI does — §11)
- Single-user-scoped, **RLS-enforced server-side**; model proposes, backend validates
  & whitelists every argument; model never touches the DB. Confirmation tiers per §11.
- **Jailbreak/social-engineering resistant**: instructions in user/inbound/uploaded text
  can't expand tool scope, bypass confirmation, or reveal another member's data.
- **Rate limits** on tool calls and sends; anomaly detection on bursty/odd activity.

### Layer 5 — Output/delivery & data guardrails
- **Auto-sent content is safety-checked before it leaves** (§2b autopilot): sensitive
  moods → gentler/optional; detected conflict/crisis → **hold and surface to the user**,
  never auto-send.
- **Cross-member privacy is absolute**: private data (§2/§3c) never leaks to another
  member or into content composed for them.
- **Redaction before AI (from SchedaPRO `domain/redaction.ts`)**: pseudonymize real
  names/identifiers **before** any provider call, so raw identities don't leave the
  device unnecessarily. Especially important for sensitive relationship data; the
  context-builder (§9) applies this on the way out.
- **On-device-first data (SchedaPRO pattern)**: prefer keeping personal data local
  (encrypted), sending the AI only what's needed; **encrypted, portable export** and a
  **user-scoped storage namespace** so multiple users on one device never share data.
- **Data protection**: encrypt sensitive data at rest/in transit; data minimization;
  **user data export & delete** (GDPR/CCPA); relationship/emotional data is a *sensitive
  category* → explicit consent for processing. Third-party channel data shared only as
  needed to deliver.

### High-severity scenarios (non-negotiable protocols)

A shared protocol for all three: **Detect → Drop the persona → Respond with care →
Surface region-correct resources (`crisis_resources`, §10.6) → Restrict what the app
will do → Record/flag for review.** Always **err toward safety and never gatekeep
help**. Never minimize, diagnose, play-act, or provide harmful means/methods/instructions.

**A. Self-harm / suicide (danger to self)**
- On ideation/intent signals: stop normal advice, respond with non-judgmental care,
  and make **crisis lines + emergency services + a trusted person** easy to reach now.
- Never provide methods or anything that could facilitate self-harm; never discourage
  seeking help. Encourage professional support; the bartender is not a substitute.
- After an episode, future check-ins/autopilot soften automatically (no breezy
  one-liners into a crisis); keep a resource always one tap away.

**B. Violence (danger to or from a person)**
- **User is a victim** (IPV/DV, threats): prioritize their safety; surface DV resources
  and safety-planning info. **Never suggest actions that could escalate danger** (e.g.
  confronting an abuser). Be aware the device may be monitored (see Device safety).
- **User expresses intent to harm another**: take it seriously, **do not assist**, do
  not coach it, de-escalate, and point to crisis/support resources. Never help plan,
  locate, or carry out harm.
- The app/tools must **never facilitate violence** (no helping find, track, or corner a
  person — overlaps Stalking).

**C. Stalking / surveillance (the app as a weapon)**
- Highest app-specific risk: features like check-ins, "message a member," autopilot,
  and ended/archived relationships could be misused to **monitor, track, repeatedly
  contact, or surveil** someone — including an ex or someone who set boundaries.
- The AI and tools **refuse** to: locate/track a person, infer their whereabouts,
  bypass a block/mute, mass- or repeat-contact against their wishes, or "keep tabs."
- **Boundaries are enforced in code, not just by the model**: if a member **mutes,
  leaves, or is in an archived relationship**, the send tools / autopilot **cannot
  reach them** — no AI request can override this. A person who exits is unreachable
  through the app.
- If a user appears to be **the target** of stalking, surface resources and the
  device-safety options below.

### The persona-drop message (canonical copy)
When the bartender hits a high-severity scenario or anything out of its depth, it
breaks character with this honest, warm deflection (template — **localized (§10)**,
with **region-correct numbers/resources from `crisis_resources` (§10.6)**, not
hardcoded):
> "I'm just an artificial bartender — not a professional, and some things matter more
> than anything I can offer. If you or someone you know might be in danger, please call
> **[local emergency number]** now. For a health problem, reach out to your doctor.
> And for what's weighing on you, a therapist in your area can really help —
> [optionally: want a hand thinking about how to find one?]. And drive safe."
- `[local emergency number]` resolves per region (e.g. 911 US/CA, 112 EU, 999 UK,
  000 AU) — **never hardcode** one region's number.
- **"And drive safe"** is the bartender's **signature signoff** — the same warm close
  as the "bar's closed" notice (§2c). Keep it consistent across the persona's hardest
  moments; it's a small thread of care that ties the character together. (In a crisis
  reply, place it gently at the end so it never undercuts the seriousness.)
- This doubles as the **scope-limit message** (not a therapist/doctor — §12 Layer 2):
  honest that it's an AI, points to real help, stays kind. Always reachable as a
  one-tap "get help" action, not only when triggered.

### Device & victim safety (cross-cutting feature work)
Because abusers/stalkers often have physical access to the victim's phone:
- **Discreet notifications**: option to hide message content on lock screen / use a
  neutral app label; sensitive check-ins don't reveal contents in previews.
- **Quick-exit**: a fast way to leave a sensitive screen / hide the app.
- **App-lock (reuse SchedaPRO `lock/` module)**: PIN (PBKDF2) + optional biometric
  (WebAuthn) + idle-timeout lock — a ready-made basis for protecting on-device data;
  port it and keep our stronger guardrails on top.
- **No location tracking of others**, ever — not a feature we build.
- These are real build items, not just policy. Flag for design in the relevant phase.

### Eligibility
- **Adults only (18+)** given the relationship/emotional nature — gate at signup; define
  handling if a minor is suspected.

### Process & accountability
- **Red-team & eval suite**: test prompt injection (incl. via uploaded images),
  jailbreaks, coercive-control prompts, crisis detection, cross-member leakage,
  inclusivity regressions (§9) — run before each release.
- **Flag & review**: log high-risk interactions for human review; in-app **report/feedback**
  and a way to reach a human. Clear disclaimers that the advisor is AI and not a
  substitute for professional care.
- **Incident path**: defined process for safety failures; the `[support address]` (§2c)
  is monitored.

**Open decisions**
- Who owns T&S review and crisis-resource verification per region.
- Automated safety-classification approach (separate guard model/pass vs. inline).
- Exact data-retention windows and encryption specifics.

---

## 13. Reuse from the SchedaPRO sibling

`./schedapro/` is **our own codebase** (we built it). It's the third in a product
family — **PLT (legal) → SchedaPRO (fitness) → this (relationships)** — that recycles
infrastructure and swaps the domain. We may **copy snippets, lift whole files/folders,
and rewrite them** freely; no licensing concern.

**Domain mapping (PLT/SchedaPRO → here)**
- *scheda cliente* (per-client page) → **per-relationship page** (the central object;
  also the `buildCaseContext()` unit).
- *Aria* (AI persona) → **the bartender** (advisor).
- *buildCaseContext() / mergeWithAi()* → our **context-builder** (§9).
- Flash/Pro routing → **DeepSeek/Anthropic** cheap/strong split (§9a).

**Strong reuse candidates (port + rewrite to our needs)**
- AI provider routing (`ai_service.py`) — DeepSeek primary, fallback (§9a).
- `analysisManager.ts` resilient background jobs (§8).
- `domain/redaction.ts` anonymization before AI (§12).
- `lock/` app-lock module — PIN + biometric + idle (§12 device safety).
- Settings page architecture + prefs store (nightshift branch) → our settings + §3c-D.
- Encrypted export + user-scoped storage namespace (§12).
- `components/MultiFileUploadDrawer.tsx` → our **context-source ingestion drawer**
  (§2c). Keep: the bottom-sheet shell, the per-item upload **queue** (pending/
  uploading/done/error + retry), **voice-note** capture → transcribe, **URL import**,
  and the in-UI **privacy notice** ("originals stay on device; only extracted text
  goes to the AI"). Rewrite: replace fitness categories (`scheda`/`documento_medico`)
  with **visibility at upload time** (default *private*, opt-in *shared with
  relationship* — enforces the entries-visibility split in §5); make **image→OCR**
  explicit (Mistral OCR / Claude vision, §9a); **tag all ingested context as untrusted
  data** before it reaches the composer/bartender (§12 prompt-injection layer); drop
  the "Avvia Analisi AI / focus presets" fitness tail (our flow ends at "added to
  context"); route all copy through i18n (§10). ~60–70% of structure reusable; the
  domain tail is not.
- Process artifacts: `SOUL.md` + `docs/superpowers/plans|specs` convention.

**Guardrails rule — NEVER DOWNGRADE.** Our §12 guardrails are **stronger** than
SchedaPRO's. When porting any code, **keep our guardrails on top** — do not inherit the
sibling's lighter safety posture. Specifically: untrusted-content-as-data (prompt
injection), coercive-control/stalking refusal, the recipient-reachability gate (§8),
crisis protocols, and cross-member privacy must all survive the port. If ported code
conflicts with §12, §12 wins.

**Stack note (decision pending)**
- SchedaPRO is **React + Vite + TS + Capacitor** (PWA → Android), *not* Expo/RN.
  Reusing this base would change our Phase-0 stack from Expo to Capacitor. **Open
  decision** — resolve before scaffolding: adopt the sibling's web+Capacitor stack
  (maximal reuse) vs. Expo/RN (our original plan, less direct reuse).
