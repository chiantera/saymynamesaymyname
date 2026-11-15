# PLAN.md — Relationship app

Living plan. Status: **Phase 0/1 implementation authorized**. See `docs/implementation/PHASE-0-1.md` and `CURRENT-TASK.md`.
Decision closeout: **§27 is the current status index**. §1–§26 are approved unless
§27 explicitly reserves an owner choice. Routine engineering defaults are approved
by delegation, not a new queue of user questions. Setup facts still need verification.
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

1. **Schedule** — each user has: cadence (default 6h, adjustable), quiet hours, timezone,
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
- **Idempotent sends.** Persist one dispatch intent per approved check-in/channel/
  recipient and prevent duplicate internal claims. External delivery is not universally
  exactly-once; unknown provider acceptance requires reconciliation, not blind retries.
- **Per-user timing inside one tick.** The cron runs every minute initially;
  each run computes *who is individually due*, rather than one global schedule.
- **Meaning over volume.** Better one prompt that lands than six that annoy.

### Completion model — one source of truth (DECIDED)

A check-in has one authoritative lifecycle, with **one winning decision** from the
user or approval-window worker. Decision, task outcome and delivery status are distinct.

```
pending ──approve / permitted auto──> queued ──dispatch──> fulfilled | failed | uncertain
   ├──skip / default skip──────────> skipped
   ├──cancel───────────────────────> cancelled
   └──snooze───────────────────────> deferred ──resurface──> pending
```

- **Single-writer guard:** approving, skipping, snoozing or expiring an approval uses
  an atomic versioned transition. Only a valid current decision can enqueue delivery;
  workers and taps cannot create two outcomes. A default skip is never fulfillment.
- **Fulfillment by intent:** a private entry was saved, an action was explicitly
  marked done, or a message was accepted by its delivery path and recorded. Report
  delivered/read only with evidence; never infer the member actually connected.
- **One check-in → at most one resulting artifact:** share that artifact to its
  approved recipients using separate idempotent delivery attempts; group delivery
  is not a reason to duplicate the source artifact or approve more than once.
- **Acted outside the app:** offer "already did this" as self-reported completion,
  not evidence the app sent or delivered anything. Inline replies must be correlated
  to the correct pending task and cannot auto-approve an unrelated outward message.
- **Intent selection — approved by delegation:** AI may choose inward/outward/
  gesture/memory only within enabled goals, available consented context and preferences.
  No relationship → solo intents only. Outward intent is never permission to send.

---

## 2b. The AI layer (the brain of the loop)

Decision: the app is **AI-composed from v1**. The AI is not a prompt picker — it is
a relationship assistant that **generates the check-ins, reminders, and content**,
choosing intent and wording from the user's living context.

**Engine**: provider adapters; DeepSeek primary and approved Anthropic fallback (§9a).

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
  (§3c)**, subject to saved-context switches and item exclusions. Scope is the
  current user/task/relationship; no implicit whole-account or cross-member access. A compact **context-builder** assembles the
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
    **Initial preset — DECIDED:** skip after **30 minutes**, per channel, unless the
    user explicitly changes it. Silence never enables automatic sending. Both action
    and window remain overridable per channel and per individual check-in.
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
  - *Free toggle*: device-native TTS (Capacitor-compatible integration) — works offline, generic voice.
  - *Premium*: cloud AI TTS (e.g. ElevenLabs-style) for a natural, consistent
    bartender voice — a candidate paid-tier feature.
  - A fixed pre-recorded voice is ruled out: it can't speak dynamically generated text.
- **Under the hood**, its guidance is grounded in real relationship-psychology
  principles so the advice is actually sound — but that framing stays internal.
- **API-down / degraded behavior (DECIDED)**: the advisor must **never fake a canned
  conversation**. If no approved capable provider is usable, it breaks character gracefully —
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

**Scope rule**: goal/profile items are private by default. Sharing grants explicit
recipients access; membership alone never does. AI access additionally requires the
relevant context and provider consent. The shared/private flag is a UI summary, not
an authorization policy (§14/§18).

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
| **Check-in dispatch** | 1-minute tick; default 6h cadence in waking windows | the core loop |
| Date reminders | daily scan | notify ahead of anniversaries/dates (7d/1d/day-of) |
| Daily digest | morning, per timezone | upcoming dates + a resurfaced memory |
| Weekly recap | weekly | the week's entries, moods, photos |
| Streak check | daily | nudge if the space has gone quiet |

Scheduling ownership — **DECIDED hybrid**: Supabase **pg_cron** runs bounded
scheduled database dispatch to create due work. A **Frankfurt processing worker**
(reuse the PLT Render pattern) claims and executes AI/OCR/STT and delivery work.
Job state is durable in Supabase, never Vercel/function or worker process memory.
Vercel FastAPI handlers authenticate requests and create/read jobs; they do not
launch a second competing scheduler. Exact database functions/lease schema are
implementation details to validate before deploying.

---

## 5. Data model (first sketch — will evolve)

- **users** — auth identity, display name, timezone, **locale/language**. A user can
  exist with **zero** relationships (solo growth experience).
- **relationships** — a tracked connection the user defines: label, type (chosen by
  the user), created_by. Has **1..N member**s (not fixed at 2); a user has **0..N**.
  Archive is personal membership state, not global relationship status (§11/§14).
  (formerly "spaces")
- **relationship_members** — user ↔ relationship link, role/label, **status
  (active|muted|left)**, plus independent **archived_at** per user.
  Blocking is a separate user-to-user edge, never a membership-wide status.
  Archiving does not change membership or other members' archive preferences.
  N rows per relationship; supports non-dyadic
  (polyamorous) structures. Send tools/autopilot must check membership state and
  the specific sender/recipient block edge, no AI override (§12-C).
  Store `left_at` and membership version: departure ends future access but does not
  erase the user's own records or eligible previously received history (§14).
- **user_blocks** — blocker user ID, blocked user ID, created_at; enforce the block
  against the affected user pair, not against unrelated members. It never suspends
  the blocked user's account or removes their relationship membership (§14).
- **invites** — relationship, proposer, proposed recipient/verified email, expiry,
  status and membership version; single-use token digest, sent_at and redeemed_at. Any current member may propose; all current members must
  explicitly approve before an invitation is sent. Record approvals per member in
  **invite_approvals**. Issue the join token only after approval; the recipient must
  accept to join. Inviting others is optional; solo tracking does not create accounts
  or grant permissions on behalf of people outside the app.
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
- **context_sources** — source metadata and **extracted text in Supabase Postgres**
  in the dedicated European project: owner ID, optional relationship, type, original
  object ref (nullable after expiry/discard), extraction status, language, timestamps
  and original retention/byte metadata. Text persists until user deletion, independently
  of the original's expiry. Feeds the privacy-filtered context-builder. Split large
  extractions into owned, source-linked text chunks when needed; access grants apply
  to every chunk. Original binaries live separately in private Supabase Storage.
- **storage_entitlements / storage_usage** — server-controlled tier, original-storage
  allowance and measured usage per user; free/paid amounts and retention policies
  are configuration, never trusted client values. Billing integration comes later.
- **conversations** / **messages** — advisor ("bartender") chat threads and turns,
  stored privately under the owner's account in European Supabase Postgres; sync
  across their devices. Keep until user deletion on free and paid tiers (§14).
  Retention does not itself permit retrieval into future AI context.
- **goals** — relationship + personal-growth goals: scope (shared|private),
  owner, **relationship_id (nullable — null = solo/personal goal)**, type
  (relationship|growth), target, status, visibility. (§3c-A/B)
- **goal_progress** — milestones, habit ticks, streaks, progress events per goal.
- **growth_profiles** — per-person traits, love language, comm style, triggers,
  preferences; each field tagged shared|private. (§3c-C)
- **ai_personalization** — per-person voice/behavior settings for the bartender. (§3c-D)
- **saved_memories** — private, user-approved profile facts: owner, approved wording,
  source references, approval timestamp/version and update/delete state. A proposal
  is not an active memory; only approved versions may enter future AI context (§14).
  Editable/listable in the user's memory area; never a hidden extension of chat history.
- **crisis_resources** — per country/region: **emergency number**, crisis/suicide &
  DV hotlines, and links — source for the localized safety guardrail + persona-drop
  message (§10.6, §12). Professionally verified.
- **change_log** — audit of AI-initiated (bartender tool) changes: actor, tool, before/
  after, timestamp; powers "here's what I changed" + undo (§11).

---

## 6. Phased roadmap (plan-all, build-in-phases)

- **Phase 0 — Foundations**: React + Vite + TypeScript app shell with Capacitor + Supabase project, auth, solo user
  onboarding, and the ability to **create 0..N relationships** (1..N members) and
  optionally invite others. No loop yet — just users, relationships, membership.
- **Phase 1 — The AI loop, minimal**: check-in prefs (per-relationship cadence +
  quiet hours), cron dispatcher, **push + in-app** delivery, **AI compose** (provider adapter; DeepSeek primary, Anthropic fallback)
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

## 7. Cross-cutting status (see §27 for remaining owner choices)

- **AI authenticity/consent** — *resolved*: per-check-in choice (send/edit/auto/skip),
  with per-channel default action + window as the fallback, and per-check-in override
  of both. Nothing further blocking; refine preset values during Phase 1 build.
- AI tone/voice — *resolved*: bartender persona, default nudge/listen + one-liners,
  user-tunable; text-first with optional TTS later (see §2c).
- AI usage accounting and the EUR 20 testing target are agreed (§9/§16). Provider prices/rates must be verified during setup.
- Privacy model — *resolved*: members see only **resulting content**, not each
  other's check-in activity. Check-ins, decisions, and prompt history are **per-user
  private**. **Journal entries default to private; sharing is opt-in.** A private
  entry stays unseen by other members. A relationship holds only what each chose to surface.
- Paid external channel activation waits for its feature phase and a checked cost/
  permission setup. Integration design is delegated; new spending is not implicitly approved.
- Delivery reliability strategy (retries, idempotency, timezone correctness). → §8
- Hosting is decided: Vercel + Frankfurt worker + Supabase durable state (§8/§14).

---

## 8. Scheduling & reliability architecture (the engine)

This is the riskiest part — the whole app's value depends on check-ins firing at the
right time, once, on the right channel. Design goals: **timezone-correct**,
**single-writer internal state**, **reconciles uncertain external delivery**,
**survives retries**, **respects quiet hours**, handles the
**autopilot decision-window**.

**Core pattern — frequent tick + due-scan (start here)**
- A bounded `pg_cron` dispatcher ticks every **minute** initially (§27 delegated default).
- Each run computes, in SQL, the set of users who are **due now**:
  `now() >= last_checkin_at + cadence` AND `now()` is inside their waking window
  (converted to the user's timezone) AND no `pending` check-in already open.
- For each due user it **inserts a `checkins` row in one atomic step** (unique
  constraint on `(user_id, due_slot)` → idempotency: a retry can't double-insert).
- The dispatcher records durable work; the Frankfurt worker composes through the
  approved-provider adapter and presents a draft or executes an explicitly permitted
  action. The default action is still skip after 30 minutes, not automatic sending.

**Autopilot decision-window**
- Start `decision_deadline = available_at + window` when the check-in is posted to
  the user's eligible in-app inbox/presentation path, not when background composition
  starts. This is not a claim that the user read a push notification. Quiet-hour,
  pause and snooze deferral suspend/reschedule presentation as specified.
- The same tick scans for `pending` check-ins whose deadline has passed and applies
  the channel default (auto-send or skip) via the **single-writer transition** (§2 —
  whoever closes it first wins, so user-tap and the expiry job never both fire).

**Delivery reliability**
- **Recipient-reachability gate (safety)**: before any outbound send to another member,
  check membership status, the relevant user's `archived_at` and sender/recipient
  `user_blocks`. Muted/left or personally archived recipient → do not send in that
  relationship. A block prohibits contact for that user pair only (§12-C).
  A blocking B never prevents B→C or C→B delivery, sharing or plans.
  Personal archive also stops that user's relationship check-ins and automated sends
  on their behalf. Other active members' interactions with each other are unaffected.
  Recheck at dispatch and retry; cancel queued affected sends. Enforced in code; no
  AI/autopilot path bypasses it.
- **Leaving gate:** leaving stops relationship check-ins and app-mediated messages
  both to and on behalf of the departed member. Cancel queued affected work and
  prevent new sharing grants to inactive membership. Previously received history is
  read-only as of departure, subject to retention/deletion; never expose later edits
  through an old grant. Rejoining uses a new membership version and fresh consent.
- Each send is an idempotent op keyed by `checkin_id + channel`; a send is only marked
  `fulfilled` only with the appropriate acceptance evidence. Safe retryable failures
  use bounded backoff; unknown acceptance is `uncertain` and held for reconciliation.
  The private inbox reports failures; it never claims an unsent message reached a member.
- Provider webhooks (delivery receipts, inbound replies) update status and can
  auto-close the loop.

**Timezones & quiet hours**
- Store IANA timezones; evaluate quiet hours locally and persist deadlines in UTC.
  Coalesce stale/missed nudges at the next eligible window rather than replay every
  missed slot. Date-specific time-sensitive work is revalidated before resurfacing.

**Resilient background jobs (from SchedaPRO `analysisManager.ts`)**
- Long AI work (composition, digests, recaps) runs as **background jobs that survive
  navigation, phone lock, and refresh**: kick off → poll → resume → merge, with a
  **non-blocking progress indicator** and abort. Reuse this proven client-side pattern
  so the app never freezes waiting on the model; pairs with provider failover (§9a).

**Queue baseline — approved by delegation**
- Start with a durable Postgres jobs table, transactional claims, leases and bounded
  retries. The tick creates jobs; the worker executes them. No extra queue vendor is
  needed initially. A future move to a dedicated queue requires measured need and
  preserves the same idempotency, consent, revocation and budget interfaces.

**Backend**: dedicated Frankfurt Supabase for Postgres/Auth/Storage and durable
scheduling state; FastAPI reuse is decided, with Vercel for suitable request handlers.
**PLT hybrid is decided:** Vercel web/stateless FastAPI, Frankfurt processing worker
using the Render pattern, durable jobs in Supabase. Supabase owns scheduling state;
the worker owns execution. No in-memory job source of truth.

---

## 9. AI usage & cost architecture (the brain)

The AI runs on **every** check-in and every advisor turn, so design for **quality,
latency, and cost** from the start. Default routing is **DeepSeek primary,
Anthropic fallback**, through the provider-abstraction layer and approved-provider
consent gates (§9a).

### 9a. Provider abstraction (no vendor lock-in — DECIDED)

All model access goes through **one internal interface**, never a direct SDK call from
feature code. Adapters implement it per provider (DeepSeek, Anthropic, OpenAI, Google,
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
- **Failover (ties to reliability below)**: on a provider error/timeout, route only
  to another capable **user-approved provider** when automatic fallback is enabled.
  Otherwise use the static "bar's closed" / fallback-library path (§2c/§2b). An
  available but unapproved provider is not a fallback option. Approval does not waive
  item exclusions, category consent, task permissions or regional restrictions.
- **Guardrails are provider-agnostic**: the centralized system-prompt core +
  inclusivity/safety invariants (§9, §12) apply to **every** adapter; the eval/red-team
  suite (§12) runs **per provider** so swapping a model can't silently weaken safety.
- **Separate adapters** for OCR/vision, **speech-to-text (voice input)** and TTS
  (voice output), as well as chat models. Cloud processors each require provider
  approval for the relevant capability; do not treat chat approval as transcription
  or voice-output approval. Cloud voice output is separate from native device speech.
- **Voice input:** start by evaluating/reusing SchedaPRO's **Groq transcription**
  integration behind the speech-to-text adapter. Groq is the initial candidate based
  on the user's testing experience, not a promise of permanent free service. Verify
  current pricing, quotas, data handling and supported language/model capabilities
  before enabling it. Test all seven launch languages, especially Cantonese separately
  from Mandarin. Do not silently translate a transcript into another language.
  Microphone permission and processor consent are separate. Show/edit the transcript
  before sending it to chat or saving as context. Keep provider keys server-side.
  If no approved capable transcription provider is available, allow typed/pasted input;
  do not route audio to an unapproved provider. Discard recordings after successful
  transcription by default; per-recording keep-original follows storage-tier rules (§14).
- Watch per-provider differences in prompt-caching, token limits, and pricing in the
  cost controls below.

**Context-builder** (one place, reused by check-ins + advisor)
- Assembles a compact, **privacy-filtered** context slice per call: profile + goals
  (respecting shared/private), recent moods/entries the user owns or that are shared,
  upcoming dates, recent check-in outcomes, and relevant uploaded context sources.
- **Saved-context consent (§14):** journal entries, extracted documents and prior
  chats require their respective opt-in switch, plus per-item eligibility. Ownership
  or a sharing grant alone does not authorize saved-context retrieval. With switches
  off, use only the current conversation and material explicitly attached for the
  current task. Enforce permissions before retrieval, summarization and provider calls.
- Hard token budget; summarize/trim oldest eligible material rather than dumping everything.

**Cost & latency controls**
- **Prompt caching** for the stable system prompt + persona + slowly-changing profile
  → big savings since these repeat across calls.
- **Right-size models** through capability-tested provider configuration; choose a
  routine and a stronger tier only after current cost/capability/safety checks. Never
  silently move sensitive context to an unapproved provider to obtain a stronger model.
- **Don't call when not needed**: skip composition for users in quiet hours or with no
  open slot; reuse a recent generation if context hasn't changed.
- Batch non-urgent generation (e.g. digests) where latency doesn't matter.

**Reliability (failover, then two fallback modes)**
- **First, approved-provider failover** (§9a): retry only when automatic fallback
  is enabled and another approved, capable provider is available. Otherwise enter
  the appropriate static mode below; never exhaust unapproved providers first.
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
- Each user has separate **UI locale, conversational language and Chinese script**
  preferences, plus their IANA timezone (§8). Read browser/device preferences via
  the selected Capacitor/web integration; do not use Expo-specific packages.
- **Location-aware defaults — DECIDED:** preserve an explicit saved user choice
  first; otherwise honor a supported device language/script, using known country/
  region to select an appropriate regional default or break ambiguity. If no device
  preference matches, suggest a supported locale from known region; fall back to
  English when neither is available. Keep the initial choice visible and editable.
  Country/region is a suggestion signal, never a claim about the user's identity.
- Use an already known or user-supplied country/region; precise GPS is unnecessary
  for localization. Do not request location permission solely to choose a language.
  Travel or a changed device locale must not overwrite a saved preference. Language,
  script, country for help resources, and timezone remain independently editable.
- In a relationship, **each member may use a different language.** Consequence: a
  check-in/message is generated **per recipient, in that recipient's language** — not
  once for the whole relationship. The advisor speaks each user's own language.

**1. Static UI (i18n framework)**
- Use **i18next + react-i18next** with Git-versioned JSON catalogs (approved by
  delegation). No hardcoded UI strings; all copy via keys. Pin actual versions when
  adapting the sibling baseline; English is the catalog source, not a preference
  override for users of the other six supported languages.
- Handle **plurals**, interpolation, and **date/number/relative-time** formatting via
  `Intl` (e.g. "in 3 hours", anniversaries) — these are core to the scheduling UX.
- Prepare direction-aware layouts and mixed-script rendering from the beginning;
  full RTL interface locales arrive later under the approved localization scope.

**2. Dynamic AI content (the unusual part)**
- The **system-prompt core (§9)** gains an instruction: *respond in the recipient's
  locale* (passed by the context-builder). Validate each selected model on the seven
  launch languages; generate directly in-language. User-authored multilingual message
  translation is a separate audience/approval choice in §27, not permission to rewrite
  an already approved outward message silently.
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
  with **Italian, Spanish, Korean, Mandarin, Cantonese, English and German at launch**. Add the AI "respond in locale" instruction in
  Phase 1. Expand languages, RTL, and localized crisis resources as we roll out regions.

**Who translates what, and when (workflow — DECIDED)**
Translation responsibility splits by content type:
- **AI-generated content** (check-ins, advisor replies, digests, recaps): **nobody
  translates it — the approved model writes it natively in the recipient's locale** (§9).
  No translator, no pipeline, no lag. This is the bulk of what users read.
- **Static UI strings** (buttons, labels, onboarding, settings): extracted to locale
  catalogs.
  - *Launch language*: written in-house as we build (source of truth).
  - *Launch catalogs*: versioned in **Git**; use AI-assisted drafts followed by
    native-speaker review for each language. A paid external TMS is not required
    at launch; choose one later if volume and reviewer workflow justify it (§20).
- **Safety-critical & legal copy** (the "bar's closed" notice, crisis resources,
  consent/privacy, disclaimers, store listings): **professional human translation +
  verification — never machine-only.** A new language does **not ship** until its
  safety/crisis copy is professionally verified (gating requirement).
- **Crisis resources** (§10.6): sourced/verified **per country** by a qualified
  reviewer, not translated generically.

*Timing*: i18n plumbing from Phase 0 → ship Italian, Spanish, Korean, Mandarin, Cantonese, English and German → each added language goes
through catalog draft+native review for UI and **professional review for safety copy** before
that locale is enabled.

**Launch languages — DECIDED (2026-11-14): Italian, Spanish, Korean, Mandarin, Cantonese, English and German.**
This supersedes the earlier Italian/English-only scope. All seven belong to the launch
localization scope: navigation, settings, onboarding, permission/confirmation copy,
check-ins, advisor text, fallback notices and reviewed safety resources. Country
coverage is separate from language; never infer emergency resources from language.

**Chinese language/script handling**
- Treat Mandarin and Cantonese as distinct AI language preferences; do not collapse
  Cantonese into Mandarin or assume a generic Chinese prompt serves both.
- Separate UI locale/script from conversational language. Written Chinese UI and
  conversational Cantonese have different translation/review needs.
- **Script defaults — DECIDED:** Mandarin defaults to **Simplified Chinese**;
  Cantonese defaults to **Traditional Chinese**, with Cantonese phrasing in chat.
  A known region can refine an unset default: mainland China → Mandarin/Simplified;
  Taiwan → Mandarin/Traditional; Hong Kong or Macao → Cantonese/Traditional.
  Explicit language/script selections always win. These are configurable locale
  suggestions, not assumptions that everyone in a region speaks the same language.
  Users can choose Traditional Mandarin or Simplified Cantonese independently.
- Require native review for all seven launch languages, including Cantonese-specific
  conversational output, inclusive terms and safety copy. Test CJK fonts, wrapping,
  input methods and layouts on web/Android. Avoid text truncation and fixed heights.
- When audio is introduced, validate language-specific voice availability separately;
  a Mandarin voice is not a Cantonese fallback. Unsupported audio falls back to text.

**Open decisions**
- Worldwide intended access is decided; maintain per-country capability/resource review (§15).
- Next languages after the seven launch languages.
- RTL interface locales follow later; direction-aware layouts and mixed-script text support start now (§20).
- Assign native-speaker/professional reviewers per language; a TMS choice is deferred (§20).

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
  The invite tool creates a proposal, not an immediate invitation. It cannot approve
  for other members or send before unanimous approval (§14).
  - **Personal archive — DECIDED:** reversible and scoped to the requesting user.
    Hides the relationship from their active list, pauses their related check-ins and
    automated sends, and suppresses app-mediated sends to them in that relationship.
    Preserves history subject to existing access grants and retention rules. Other
    members retain their own settings. It does not leave the relationship or change
    membership. Unarchiving restores the active view without replaying missed nudges
    or cancelled messages; subsequent scheduling respects current preferences.

**Control & confirmation model (consistent with the per-check-in consent stance)**
- **Reads**: free, no confirmation.
- **Routine writes** (cadence, tone, channel toggle, add a date): apply, then **show
  a clear "here's what I changed" with one-tap undo**. Optional "always apply changes
  like this without asking" so power users can go faster.
- **Sensitive but reversible** (archive a relationship, delete a goal): **confirm
  before acting**, but recovery is easy (unarchive / restore from `change_log`).
- **Sensitive / irreversible** (delete owned relationship records/content, invite
  someone, disconnect a channel, change locale): **always confirm before acting**.
  Deleting one's private record/owned artifacts cannot delete another member's own
  content or membership. Inviting still requires unanimous approval, not one confirmation.
- Every AI-initiated change is **logged/auditable** so the user can see and revert what
  the bartender did. Nothing the bartender can do is unrecoverable without a confirm.

**Hard boundaries (NOT given to the bartender)**
- Account deletion, auth/password changes, billing/payments, anything legal/financial.
- It can never **read another member's private data** to satisfy a request (privacy
  model §2/§3c) or act on another user's account — tools are single-user-scoped and
  RLS-enforced server-side.

**Implementation notes**
- Tools execute through the **FastAPI/worker server-side action layer** against
  Supabase with authenticated user authorization and RLS where applicable. Privileged
  worker operations must revalidate ownership, grants and consent, not assume RLS
  applies to a service credential. The model proposes a call; the backend validates
  inputs and executes;
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
- **Redaction before AI (from SchedaPRO `domain/redaction.ts`)**: minimize or
  pseudonymize unnecessary names/identifiers before provider calls, with restoration
  only in authorized display/output. Cloud-authorized processing still occurs;
  do not claim that no data leaves the device. Especially important for sensitive relationship data; the
  context-builder (§9) applies this on the way out.
- **Private-cloud-first sync with local cache:** Postgres/private Storage are the
  source of truth under the agreed retention and authorization rules. Use minimal
  per-user caches, platform-appropriate local protection and clean session isolation;
  never inherit SchedaPRO's local-only privacy claim. Exports contain sensitive data
  and are delivered privately; encryption at rest is not end-to-end encryption.
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
  leaves, or personally archives that relationship**, the send tools / autopilot
  **cannot reach them through that relationship** — no AI request can override this. A person who exits is unreachable
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
- **Flag & review**: record minimal technical/risk metadata, never an automatic feed
  of private conversations to staff. In-app reports let users preview/select the
  content shared with assigned support reviewers; access is restricted and audited
  (§19). Disclose that the advisor is AI, not a substitute for professional care or
  a continuously monitored crisis service.
- **Incident path**: defined process for safety failures; the `[support address]` (§2c)
  is monitored.

**Open decisions**
- Who owns T&S review and crisis-resource verification per region.
- Separate pre-action safety gates are decided (§18); validate classifier/model and
  crisis eval quality before enabling automatic actions.
- Verify provider encryption/key settings and remaining backup/operational retention; the initial encryption model is decided (§21).

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
  and an in-UI **privacy notice**, rewritten to reflect our actual cloud retention
  and OCR/provider processing rather than claiming originals stay on device. Rewrite: replace fitness categories (`scheda`/`documento_medico`)
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

**Client stack — DECIDED (2026-11-14)**
- **React + Vite + TypeScript + Capacitor**, reusing and adapting SchedaPRO's web
  components, settings, upload drawer, and client infrastructure. This supersedes
  the earlier Expo/React Native direction. Web and native builds share the React UI.
- Plan Android and iOS wrappers; native permissions, push registration, deep links,
  secure storage, and app lifecycle handling require platform-specific validation.
  iOS build/signing requires access to macOS/Xcode; store accounts/signing are release
  prerequisites, not blockers for the initial web prototype.
- Use Capacitor-compatible integrations rather than Expo-specific packages. Push
  credentials and delivery adapters must cover the chosen native platforms; web
  push is a separate integration. Audit copied browser APIs and WebAuthn against
  each target platform before relying on them.
- Client choice is independent of hosting. FastAPI and Vercel directions are now
  decided (§14); Vercel plus a Frankfurt processing worker and durable Supabase job state are decided.

## 14. Decisions before building vs. before release

Planning baseline is agreed. The latest ten choices (§26) are approved; remaining
routine defaults are delegated (§27). This historical walkthrough is not a fresh
proposal queue. The current action is documentation only; implementation/deployment
requires a separate build instruction. Preserve the agreed phased scope.

**Agreed baseline for the first implementation slice**

| Decision | Why it affects the build | Proposed starting point |
|---|---|---|
| Backend boundary — FastAPI reuse DECIDED | Determines API contracts, secrets, and job ownership | Reuse/adapt SchedaPRO FastAPI alongside Supabase Auth/Postgres/Storage. Vercel is selected for web/suitable request handlers; Frankfurt worker executes durable Supabase jobs; Supabase dispatch owns scheduling. |
| Data home — dedicated European Supabase project DECIDED | Determines sync, access controls, and migrations | Frankfurt (`eu-central-1`) is selected. Private cloud sync is the default (decided). AI-context permissions remain separate. Shared data, synced private records and scheduling use server authority; local storage is a cache. |
| Relationship permissions | Determines the first schema and authorization rules | Distinguish a private relationship record about someone from invited app membership. Invitation unanimity, recipient-specific sharing, personal archive, immediate leave and pairwise blocking are decided; enforce them in permissions and queued-send cancellation. Never treat tracking someone as their consent to receive messages. |
| First target — web + Android DECIDED | Makes completion testable | Web development and Android validation first; iOS testing/release follows later, with compatibility considered throughout. Solo onboarding, optional relationship, one AI check-in, approve/edit/skip, in-app result; add native push to complete Phase 1. No outward autopilot without explicit recipient/channel authorization. |
| Launch languages — Italian, Spanish, Korean, Mandarin, Cantonese, English and German DECIDED | Affects all UI copy and safety resources | Worldwide intended access is decided (§15). Build i18n from the first screen; review UI, fallback and safety copy in all seven languages. |
| Retention and provider data rules — DECIDED baseline | Affects storage, logs, exports, deletion, and failover | Apply §14/§19/§21/§23 retention and consent. Verify actual provider/backup configuration; reserve owner choices in §27. |

**Resolve while building, before the affected feature is enabled**
- Initial authentication methods are decided: email/password and Google sign-in
  on web and Android. Implement email verification, recovery and invite/deep-link
  continuation before onboarding is complete; invitation validity is decided below.
- Concrete AI models, task budgets and spending limits; provider keys stay server-side.
- Retry policy and provider capability tests; assess reused code before selecting exact versions.
- Safety implementation: server-enforced tool permissions and send gates, classification
  approach, crisis-path tests, and reviewed localized responses before advisor/autopilot use.
- Native push provider setup, delivery receipts, quiet-hour behavior and timezone tests.
- Accessibility, notification privacy and device-lock behavior on actual devices.

**Can wait until release or later phases**
- Store accounts/signing, production domains, support address and incident ownership.
- T&S reviewer and regional-resource verification ownership before public availability.
- Additional channels and their billing/accounts, Google Drive import, cloud TTS,
  translation-management vendor, additional locales/RTL rollout and monetization.
  Google Drive import means explicit user-selected files, private by default, using
  the same ingestion and untrusted-content rules as local uploads; OAuth scopes and
  one-time selected-file import is already decided; validate exact OAuth scopes
  before that integration.

**First-slice acceptance criteria**
- A solo user can complete onboarding and a check-in without adding a relationship.
- Two accounts cannot access each other's private entries, prompts or uploaded context.
- User action and a concurrent worker cannot cause duplicate fulfillment; delivery
  retries account for provider ambiguity rather than claiming universal exactly-once delivery.
- Leaving/blocking/archiving is enforced by the send path, including queued work.
- AI failure produces the agreed localized fallback; no secrets ship to the client.

**Decision walkthrough (one at a time)**
- Confirmed 2026-11-14: reuse FastAPI; dedicated Supabase project in Europe;
  initially Italian and English; expanded to seven languages below. No services have been provisioned.
- **Private cloud sync — DECIDED (2026-11-14):** journals, advisor chats, personal
  goals and uploaded/extracted context sync under the user's account by default,
  available across their devices. Account-private access is enforced server-side;
  syncing never makes records visible to relationship members. Sharing stays explicit
  and opt-in. Provider access remains a separate permission/policy decision; syncing
  does not itself authorize sending content to an AI provider. Original retention is
  specified below; backup purge and concrete encryption/key settings require verification (§21).
- **Invite visibility — DECIDED (2026-11-14):** accepting an invite grants access
  only to content explicitly shared with that person. Existing private notes, chats,
  goals and uploads remain private. Adding a member does not expand any existing
  content's audience or expose previously shared history automatically; its owner
  chooses what to share with the new member.
- **Schema consequence:** shared/private is a UI summary, not sufficient authorization.
  Persist explicit per-item recipient grants (e.g. `content_shares` with content owner,
  item and recipient IDs). Enforce those grants server-side for reads, media URLs,
  search, AI context and exports. Relationship membership alone is never a grant to
  historical content. This refines earlier references to "shared with relationship".
- **Invitation approval — DECIDED (2026-11-14):** any current member may propose
  an invitation, but every current member must explicitly approve before it is sent.
  The proposer's explicit proposal counts as their approval. Missing approval is
  pending, never implied consent; any rejection prevents sending. The recipient
  separately accepts to join. For a solo record, the sole member's proposal satisfies
  unanimity. Approval applies to the named recipient and current membership version;
  membership changes invalidate pending approvals and require a fresh approval round.
  Final approval checks and send authorization are enforced server-side. The bartender
  cannot approve on another member's behalf. Joining does not expand past audiences.
- **Personal archiving — DECIDED (2026-11-14):** archive applies only to the user
  choosing it. Hide from their active list, pause their relationship check-ins and
  automated sends, and preserve their history. Other members' settings remain theirs.
  Maintain the existing reachability safeguard: suppress sends to the archived user
  in that relationship. Cancel affected queued work; unarchiving never replays missed
  messages. Archive is independent of membership, leave and block.
- **Leaving — DECIDED:** any member may leave immediately without approval.
  Stop future sharing, relationship check-ins and app-mediated relationship messages
  to/from that membership; cancel affected queued sends. The user retains their own
  content and previously received history, subject to deletion/retention rules. This
  is historical access only: later edits, uploads and shared items remain inaccessible.
  Model retained history using received versions or equivalent cutoff-aware grants,
  not unrestricted access to live shared records. Departure is enforced server-side
  for content, AI context, search, exports and delivery. Other members cannot undo it.
  Rejoining requires a fresh invitation, unanimous approval by current members and
  acceptance by the returning user; it grants no automatic access to missed history.
  Membership changes invalidate pending invitation approvals as already specified.
- **User-to-user blocking — DECIDED:** blocking affects only the two users involved.
  If A blocks B, stop app-mediated contact between A and B, including automated
  messages, direct invitations and new sharing; cancel queued affected deliveries.
  B and C remain free to communicate, share and make plans together. A cannot use
  blocking to suspend B's account, remove B from the group, or veto B/C interactions.
  No automatic leave/archive or membership changes result from blocking.
  For group sends and plans, evaluate actual recipients individually: B/C-only plans
  remain allowed, while group fan-out must not deliver blocked-pair contact to A.
  No AI tool may relay blocked contact through another member to bypass the block.
  Existing unanimous approval still governs adding members to the shared relationship;
  it does not govern ordinary B/C conversations or plans. Previously received history
  follows retention/deletion rules. Implement pairwise authorization, never a global
  "blocked member" flag. Exact group-content presentation can be refined in the UX.
- **First platforms — DECIDED:** web and Android first. iOS is a later validation/
  release target; retain portability in the client design.
- **Expanded launch localization — DECIDED:** Italian, Spanish, Korean, Mandarin, Cantonese, English and German.
  See §10 for separate UI/script and AI-language preferences and review requirements.
- **Chinese defaults and location — DECIDED:** Mandarin/Simplified and Cantonese/
  Traditional, with known-region refinements for unset preferences (§10). Saved
  choices override suggestions; script and conversation language remain independent.
- **Free-tier context-original retention — DECIDED:** retain uploaded source originals
  privately for **30 days** by default; offer **extract text and discard original**
  per upload. Discard mode removes the app's original after successful extraction;
  never delete the user's source on their device or Drive. Explain any temporary
  upload/OCR processing before extraction. A failed extraction must not silently
  destroy the only app copy before a user can retry or choose discard.
- **Free-tier original-storage cap — DECIDED:** **50 MB per user**, whichever limit is
  reached first (30-day age or total retained-original bytes). Cap scope is the
  user's uploaded context originals, not each relationship separately.
  At capacity, remove the **oldest retained originals first**, ordered by upload
  time, until the new retained original fits. **Keep extracted text and source
  metadata**; capacity eviction never deletes them. Show affected originals before
  accepting the upload, with an option to extract text and discard the new original.
  Evict only sources with successfully persisted extracted text; failed/pending
  extractions require retry or an explicit discard choice, not silent data loss.
  Complete extraction successfully before committing evictions. Serialize quota
  updates per user so concurrent uploads do not exceed the retained-original cap.
  A single original larger than 50 MB cannot be retained under this quota; offer
  text-only extraction within processing limits rather than evicting unrelated files
  for an original that cannot fit. Temporary processing limits are separate.
- Track upload time, original byte size, retention mode, expiry and deletion status.
  Expiry removes original objects and app-generated source previews/cached copies;
  revoke source access links. Keep a source metadata record and extracted text so
  citations can state that the original expired. Backup purge lag and any OCR-provider retention are separate decisions; do not
  describe primary-storage expiry as instant deletion from every backup/provider.
  Schedule expiry on the server even if the user never reopens the app.
- This retention applies to **context sources**; intentionally saved memory/gallery
  photos are a separate class and must not expire by accident under this policy.
  Sharing an original does not silently extend its retention. Existing grants govern
  visibility while the original exists.
- **Extracted-text retention — DECIDED:** retain privately in the user's account
  until the user deletes it, on free and paid tiers. Original expiry, quota eviction,
  or text-only extraction must not delete extracted text. Users may review/correct/
  delete it; granting AI access remains separate. Deletion must also remove derived
  chunks/search indexes and exclude deleted text from future AI context; backup
  deletion lag and treatment of already generated chat content require explicit rules.
- **Free and paid versions — DECIDED:** free offers limited original cloud storage
  (the 50 MB / 30-day policy above); paid offers substantially more cloud space.
  Paid allowance is 5 GB per user (§19); price remains open. Full-quota and downgrade handling are decided below.
  Text retention is not a promise of unlimited ingestion: text-volume, per-file OCR,
  AI request and abuse limits must be budgeted separately. Exhausting a future
  ingestion allowance must not silently evict retained extracted text.
  Expose original-storage usage and expiry clearly; design entitlements now, defer
  payment integration until its phase. The initial paid original-storage quota is 5 GB (§19).
- **Paid original retention — DECIDED:** originals retained under an active paid
  allowance have no automatic time-based expiry; keep them until the user deletes
  them, within that allowance. The free-tier 30-day expiry and oldest-first quota
  eviction do not apply to paid originals. Preserve private access and the per-upload
  extract-and-discard option. Account deletion remains a separate action; subscription
  expiry follows the 30-day grace policy below. Cancellation while paid access is
  still active must not trigger the free cleanup job.
  Cleanup jobs must check current server-side entitlements before deleting an original.
  An upgrade cannot recover originals already deleted under the free policy.
- **Paid full-quota behavior — DECIDED:** preserve every existing original; pause
  retention of new originals when an upload would exceed the user's paid allowance.
  Do not apply oldest-first eviction. Offer user-directed deletion, an increased
  allowance when available, or extract-text-and-discard for the new source within
  separate processing limits. Reading, downloading and deleting existing originals
  remain available. Keep extracted text untouched. Enforce quota and reservations
  server-side for concurrent uploads; temporary extraction files are processing data,
  not retained originals, and require their own cleanup limits. Resume original
  storage when enough space becomes available.
- **Paid expiry/downgrade — DECIDED:** provide a **30-day grace period from the
  actual end of paid access**, not from a cancellation request. Preserve existing
  originals during grace, with read/download/export/delete available. Pause new
  original storage if it would exceed the free allowance. Extracted text remains.
  Show the exact grace deadline and upcoming cleanup in-app, with permitted reminder
  notifications; offer export or renewal before cleanup. Do not expose sensitive
  source details in reminder notifications.
  After grace ends, apply the free policy: remove originals older than 30 days,
  then evict oldest remaining originals as needed to fit 50 MB. Age is measured
  from original upload, not reset at downgrade, so older paid originals may all
  expire at the grace deadline. Preserve extracted text and source metadata.
  Renewal before cleanup restores paid retention; recheck current entitlements
  before deletion so a stale job cannot delete a renewed user's originals.
  Original deletion is not reversible by renewing afterward. Backup purge lag is
  documented separately. Explicit user deletion can still occur during grace.
- **Chat-history retention — DECIDED:** keep bartender conversations privately in
  the user's cloud account until the user deletes them, on both free and paid tiers.
  Offer deletion of an individual conversation or all history. Other members cannot
  access private chats; storage alone does not authorize use in later AI calls.
  Deleting history removes its messages and derived chat summaries/search indexes
  from active storage and future retrieval. Already shared artifacts are separate
  records and must be identified clearly rather than silently deleted or claimed
  erased. Backup purge timing and provider-side retention remain separate policies.
- **Saved AI context — DECIDED:** an opt-in **Use my saved context** setting with
  independent switches for **journals**, **extracted documents** and **previous chats**.
  Default off until the user opts in. Allow exclusions for individual entries, sources
  and conversations; a category switch never overrides an item's exclusion. Exclusion
  does not delete content or change sharing grants. These controls apply to all saved
  context retrieval, including advisor chat, scheduled check-ins, digests and recaps.
  With no opt-in, use the current conversation and explicitly attached material only;
  attaching material authorizes that task, not future automatic reuse. An excluded
  item can only be used through a new explicit task-specific attachment/action.
  Persist settings and item exclusions privately with the user's account, enforce
  them server-side, and recheck before queued generation/retries. Derived summaries,
  embeddings/retrieval results and cached prompts inherit source restrictions; invalidate
  affected reusable context when consent changes. Do not claim this erases information
  already delivered to providers or present in old replies. Cross-member access and
  provider approval remain separate requirements; these switches never expand either.
- **Provider approval — DECIDED:** obtain separate approval for each external AI
  processor and the capability/data involved: chat/generation, OCR/vision, speech-to-
  text, and cloud voice output. Let users separately enable automatic fallback, which
  may use only already approved providers. Present provider identity and the data
  sent before approval; private cloud sync is not processor approval. Revoking approval
  blocks future calls, including queued tasks, retries and fallback, without claiming
  to recall data already transmitted. Persist consent versions and enabled capability
  scopes per user; enforce routing server-side and record the processor used without
  logging raw private content. No approval via inferred location or another member.
  If approvals leave no usable provider, use honest static fallback/typed input.
- **Voice-input provider — DECIDED direction:** include a dedicated speech-to-text
  adapter, initially evaluate **Groq** from the sibling integration. Actual enablement
  requires language/capability, cost and data-policy checks plus user approval (§9a).
- **Recorded-audio retention — DECIDED:** discard original audio after successful
  transcription by default. Preserve the editable transcript in the current draft;
  sending/saving it creates the usual private chat/context record, retained until
  user deletion. Do not auto-send the transcript or silently save an abandoned draft.
  Remove app-held temporary audio after processing; this does not claim immediate
  deletion from provider systems, whose retention must be disclosed separately.
  Failed transcription follows bounded temporary-processing cleanup with retry/discard
  options, not indefinite storage or a false success notice.
  Offer a per-recording **Keep original audio** option, private by default. Retained
  recordings count toward the same per-user context-original quota: free 30-day /
  50 MB oldest-first policy; paid no time expiry within allowance; full paid storage
  pauses retention with an explicit text-only option. Apply downgrade grace rules.
  Deleting/expiring audio leaves saved transcript text intact. An expired or discarded
  recording cannot be recovered by later selecting keep or upgrading.
- **Saved profile memories — DECIDED:** require explicit approval for each memory
  before it becomes active. The bartender can propose "Remember this?" with the exact
  wording and intended scope; silence, category context opt-in or chat retention is
  never approval. Existing memories cannot be silently revised with inferred facts:
  substantive AI-proposed updates require fresh approval. A user directly creating or
  editing a memory is an explicit action. Store approved memories privately and sync
  across devices; offer a visible **Saved memories** list with edit/delete controls.
  No automatic sharing with relationship members. Memory approval authorizes future
  use of that fact in the user's permitted AI tasks, subject to approved providers and
  audience/privacy rules. It never authorizes reuse of the entire source conversation.
  Per-item exclusions/revocation also apply to memories and their derived context.
  Deletion must invalidate active memory/context caches and prevent silent recreation
  from retained chat; a later proposal needs fresh explicit approval. Keep source links
  so deleting/excluding a source can identify derived memories for removal or explicit
  independent reapproval, rather than bypassing the source restriction through memory.
- **Initial authentication — DECIDED:** **email/password and Google sign-in** for
  web and Android, using Supabase Auth alongside FastAPI. Include email verification
  for password sign-up and password recovery. Validate sessions server-side for
  private API operations; authentication does not substitute for item/member access
  checks. Keep credentials and sessions isolated from AI context and logs.
  Preserve pending invite intent through sign-up/sign-in and return to an explicit
  acceptance screen; signing in alone must not join a relationship. Google sign-in
  requests identity access only, not Google Drive/Calendar permissions. Those are
  separate optional integrations with their own authorization. Final callback/deep-link
  URLs and account-linking behavior require validation during implementation.
- **Invitation validity — DECIDED:** an invitation expires **7 days after sending**,
  not 7 days after proposal. It is single-use and bound to the intended recipient's
  verified email. Require authenticated matching-email redemption and explicit join
  acceptance; a forwarded link cannot authorize a different user. Redeem atomically
  to prevent concurrent duplicate joins. Recheck unanimous approval, current membership
  version, expiry, revocation and pairwise block rules server-side at redemption.
  Store a token digest, not a reusable plaintext secret; avoid tokens in logs.
  Expired/revoked invitations cannot be redeemed. Resend/reissue must revalidate the
  approval rules and invalidate the previous link; no silent change of recipient.
- **Initial no-response preset — DECIDED:** **skip after 30 minutes**. Initialize
  each channel with this action/window, retaining per-channel settings and per-check-in
  overrides for both. No response never opts a user into auto-send. On expiry, close
  the pending approval without sending the drafted message; keep private decision
  history subject to its retention rules. A prompt already delivered to the user is
  distinct from delivery of its drafted message to another person.

**Scheduling, previews and beta access — DECIDED**
1. **Initial cadence:** every **6 waking hours**, configurable per relationship
   and for solo growth. Multiple relationships need a user-level fatigue limit rather
   than multiplying nudges without bound; detailed cap can be refined during design.
2. **Initial quiet hours:** **22:00–08:00 in the user's timezone**, editable.
   Defer scheduled nudges; do not burst-deliver overnight backlog in the morning.
   The approval window for a nudge should start when presented, not while it is
   deferred during quiet hours. No automatic outgoing send should bypass quiet hours.
3. **Notification preview:** discreet lock-screen content by default, such as
   "You have a check-in", without names, message text, relationships or sensitive
   details. Users may opt into richer previews. This turns the agreed discreet-
   notification requirement into a specific default.
4. **Initial access:** an **invite-only beta**, with explicitly admitted
   testers before public signup. Beta admission is separate from joining a relationship;
   every relationship invitation still follows unanimous approval and recipient consent.

**Hosting, region, worldwide access and budget — updated decisions**
1. **Vercel — DECIDED direction:** use Vercel rather than Netlify for the web app,
   and deploy suitable FastAPI request handlers there. Reference inspected locally:
   `C:/projects/plt/vercel.json`, `alpha-pwa/README.md`, and the showcase deployment
   chat `01a1b1f3-08dc-7993-bbe2-d06c003f4f29`. PLT uses Vercel Services for Vite plus
   FastAPI, with same-origin `/api`; it forwards AI/OCR/transcription/background routes
   to Render. Reuse configuration patterns, not PLT's live API URLs or credentials.
   **Hybrid — DECIDED:** a Frankfurt processing worker using the PLT Render pattern
   handles durable AI/OCR/transcription and delivery work; Vercel hosts the web UI and
   stateless FastAPI request layer. Reuse code after adapting persistence and guards.
   Durable queue/job state belongs in Supabase, not process memory. Supabase dispatch
   creates due jobs; the worker claims bounded tasks with leases, heartbeats and
   recoverable retries. Vercel creates/reads jobs but does not own a duplicate scheduler.
   Recheck consent, reachability, tier and budget before each attempt. A worker crash,
   refresh or deployment must not lose jobs or cause uncontrolled duplicate sends.
   Use direct authorized uploads to private Supabase Storage, not large file bodies
   routed through a function; handlers receive scoped object references.
2. **Frankfurt — DECIDED:** dedicated Supabase in `eu-central-1`; Vercel request
   compute in Frankfurt (`fra1`) and any separately hosted worker in Frankfurt where
   supported. Static frontend assets can use the global CDN; private user records
   never become static assets/build outputs. AI/OCR/STT provider processing, logs and
   backup locations need separate checks; Frankfurt primary data is not an all-data-
   stays-in-Europe promise.
3. **Worldwide — DECIDED product scope:** replace Italy-only rollout with worldwide
   intended access, retaining invite-only beta admission and seven initial languages.
   Implement the worldwide plan in §15. Actual availability depends on service and
   regional constraints; do not advertise untested universal provider coverage.
4. **AI test budget — DECIDED:** EUR 20/month aggregate target ceiling across text,
   OCR, transcription and cloud speech for development/beta, separate from hosting
   and storage. Implement usage accounting and conservative reservations (§16).
   This is a budget target, not an estimate that it can support unlimited testers.

## 15. Worldwide access implementation plan

- **Independent settings:** UI locale, conversation language, script, timezone and
  country/region are separate. At onboarding, offer a visible country suggestion from
  already available region information and let the user correct it or leave it unknown.
  Never infer country from language alone or require precise location permission.
  Travelling users can change the country used for local help without changing saved
  language preferences or the primary European data location.
- **Country capability registry:** server-owned records for country, feature/channel,
  available providers and last-reviewed state. Provider consent remains mandatory.
  Enable/disable only the affected integration when unavailable; preserve access to
  private journals, downloaded help material and saved history. Country-specific
  processor, distribution and commercial restrictions must be checked before enabling
  a feature there, not guessed from the user's language or bypassed through failover.
- **Help-resource directory:** expand `crisis_resources` with region, supported
  languages, emergency/support category, source URL, verification time and review
  status. Display reviewed resources for the user's current confirmed country.
  Unknown country → ask for country only when relevant to finding help; meanwhile
  give a clear general direction to local emergency services, without inventing a
  number or choosing a US/EU default. Known country without a reviewed specialized
  resource → say so and offer reviewed general help if available. Static basic
  safety messaging remains accessible without AI budget or provider availability.
- **Worldwide beta testing:** invite testers across supported locales/regions; test
  sign-in alternatives, actual network reachability, notification delivery, fonts/
  scripts, local times and country-resource resolution. Google sign-in availability
  cannot be assumed everywhere; email/password remains a separate option, also tested.
- **Feature-level rollout:** keep basic app access worldwide where service is available,
  while validating localized advisor safety, messaging and paid distribution per region.
  Seven interface languages do not imply seven supported countries or coverage of every
  world's language. Show supported-language choices honestly.
- **Backend authorization:** enforce admission, region/capability, pairwise/member,
  item, provider-consent and budget gates on the server. An unavailable capability
  must not leak private data to another provider or break export/delete access.

## 16. Usage accounting and the EUR 20 AI test budget

**One accounting path for all processors**
- Route chat, check-in generation, summaries, safety-model calls, OCR, STT and cloud
  TTS through the shared adapters. Every attempt, retry, tool-loop step and fallback
  is a separately tracked potential charge, linked to its logical task.
- Store **usage_events**: task/attempt IDs, provider request ID, model/capability,
  timestamp, account/project attribution, tokens by billing category, audio duration,
  pages/characters where applicable, pricing version/currency, estimated charge,
  reported/reconciled charge and reconciliation status. No raw chat, documents or
  recordings in cost logs. Deduplicate receipts/webhooks, not legitimately distinct
  retry charges. Groq testing usage is still tracked even when confirmed free.
- Store a versioned **provider_price_catalog** and **budget_reservations** in Postgres.
  Prices, cached-token rates, free credits and minimum billing increments must be
  verified against the selected model/account. Never treat a missing price or missing
  usage receipt as zero cost. Use bounded output/context/audio/page limits so a
  pre-call reservation is meaningful.
- **Reserve → execute → settle:** atomically reserve a conservative maximum estimate
  before dispatch. Refuse new discretionary work when posted estimates plus pending
  reservations would exceed the remaining budget. Settle using response usage and
  reconcile against provider usage/billing exports or APIs where available. Unknown
  timeout charges remain pending estimates until resolved; do not immediately free
  their budget and launch an unbounded retry. Apply the same process to fallbacks.
- Use dedicated app credentials/projects where supported to separate PLT/SchedaPRO
  spend. Provider account totals can contain unrelated usage; reconcile the app's
  events before treating a balance change as its spend. USD-priced providers require
  recorded EUR conversion assumptions and a buffer, not a claim of exact live FX.

**Small admin cost view, not manual spreadsheets**
- Show month-to-date estimated/reconciled AI cost, pending reservations, remaining
  budget, provider breakdown and top-cost task types; include last reconciliation
  time and unknown/unpriced usage. Separate hosting/storage invoices from the AI meter.
- Proposed alert thresholds: 50%, 80%, 95%; stop new discretionary calls before the
  EUR 20 target after reservations/buffer. Keep static check-ins, help resources and
  read/export/delete available. No silent billing increase, provider change or hidden
  model downgrade to continue beyond budget.
- Configure provider-native spend limits/prepaid controls where available as a second
  layer, with auto-top-up disabled for the beta where supported. Vercel Spend Management
  governs Vercel metered usage, not direct DeepSeek/Groq/Anthropic invoices; a Vercel
  budget alone does not cap those APIs. Platform limits/usage reports can lag, so this
  is conservative enforcement, not a guaranteed aggregate invoice hard cap.
- Application budget target is agreed; exact currency rounding, safety buffer, provider
  allocations, rate limits and alert destinations remain implementation details to
  validate before paid calls. Default to pausing calls with unknown cost rather than
  silently allowing unmetered spend.

Sources checked 2026-11-14:
- https://vercel.com/docs/services
- https://vercel.com/docs/functions/configuring-functions/region
- https://vercel.com/docs/spend-management
- https://api-docs.deepseek.com/api/create-chat-completion/
- https://console.groq.com/docs/spend-limits

**Hybrid architecture decision recorded:** Vercel + Frankfurt processing worker
(PLT Render pattern), with durable Supabase job state. No provisioning or deployment
has been performed. Worker sizing and credentials are implementation setup choices;
paid capacity/pricing remain later product decisions.

## 17. Offline use, nudge limits, device lock and account deletion — DECIDED

1. **Offline use:** allow reading cached content and drafting/editing personal notes
   offline. Sync through an explicit conflict-aware outbox on reconnection. Require
   a live authorization check for sharing, invitations and message sending; do not
   silently send offline drafts when connectivity returns. Never cache another
   member's private data. Cache limits/local protection follow the privacy model.
2. **Nudge fatigue limit:** start with **3 proactive nudges per user per local day**
   across all relationships and solo growth, editable. A multi-channel delivery of
   one nudge counts once. Coalesce/defer low-priority reminders instead of multiplying
   them per relationship. Apply this to proactive prompts, not user-requested replies,
   ordinary incoming member messages, security notices or user-opened help resources.
3. **Device lock:** offer an **optional app PIN/biometric lock** during onboarding,
   with a **5-minute idle timeout when enabled**. Use supported platform
   security and validate the sibling module on web/Android. Login and local app lock
   are separate. Lock previews remain discreet regardless of whether app lock is on.
4. **Account deletion:** offer delete-account in Settings, with clear final confirmation
   and export beforehand. Stop jobs/delivery and revoke sessions on deletion, then
   remove owned live records, originals and derived context; document actual backup
   purge lag. Other members' accounts and unrelated B/C activity remain intact.
   Previously shared/received records follow explicit source-aware revocation (§18);
   never promise recall of another person's downloaded copy. The bartender may open
   the settings/help flow, but cannot delete an account through its tools.

All four above were approved. Apply these defaults to the first relevant phase;
implementation must preserve the previously agreed privacy and consent controls.

## 18. Conflicts, unsharing, safety gates and exports — DECIDED

1. **Offline edit conflicts:** if the same note is changed on two devices, preserve
   both versions and ask the owner which to keep or merge. Never silently overwrite
   a substantive edit. A server-side deletion must not be undone by an offline edit;
   offer recovery as a new private draft only through an explicit user action.
2. **Unsharing content:** allow the owner to revoke a recipient's future access to
   the live shared item immediately. Remove that item's grants, pending deliveries,
   search results and future AI context for that recipient. Leaving alone retains
   previously received history as agreed; explicit unsharing/deletion overrides live
   access even for a departed member. Explain that independent downloaded copies or
   already delivered external messages cannot be recalled. Handling references and
   independently authored replies must preserve other users' own content without
   retaining hidden readable copies of a revoked source.
3. **Safety checks before actions:** use a separate server-side safety/authorization
   gate before outward automatic sending and sensitive AI tool execution, rather than
   trusting the composing model alone. Deterministic permissions/block/consent checks
   always apply. A separate model check may use only approved processors and consumes
   budget. If a required check fails or is unavailable, hold the action and explain
   why; do not bypass it or imply a human tap overrides hard safety boundaries. Static
   help resources remain available without paid AI checks. This does not claim perfect
   crisis detection or substitute for the existing response protocols.
4. **Data export:** offer an account-private downloadable ZIP containing readable
   journal/chat/context text, structured JSON metadata and approved memories, plus
   originals still retained and accessible. List expired originals rather than claiming
   they are included. Include only owned content or content the requester currently
   has permission to export, never other members' private data. Scope exports clearly
   to the user's perspective; quota and billing records need no raw private text.
   Require authentication and short-lived private download access, not public links.

All four above were approved. Apply them to schema, action gates and export design.
This settles separate pre-action gates; the concrete safety-model provider/evaluation
still requires validation before automated actions are enabled.

## 19. Paid allowance, beta billing, diagnostics and support access — DECIDED

1. **Initial paid storage allowance:** **5 GB per user for retained context originals**,
   configurable server-side so additional tiers can follow. No automatic time expiry
   under active paid access; the agreed full-quota and downgrade rules still apply.
   This is a product allowance, not a provider-cost estimate or pricing
   commitment. Gallery memories share this byte allowance under §21, with separate
   non-expiring retention. Extracted-text and AI processing/ingestion limits must not
   be advertised as unlimited.
2. **Beta billing:** defer real payments during the invite-only beta. Assign free or
   time-limited paid-feature entitlements manually to selected testers, with visible
   storage limits and an end date. No payment card or automatic renewal. Expiring
   a paid-feature grant follows the same 30-day grace and notices already agreed.
   Track aggregate original storage as well as the EUR 20 AI budget; test entitlements
   do not authorize unlimited hosting spend. Set public pricing after measured beta
   usage and before accepting subscriptions.
3. **Technical diagnostic logs:** retain redacted technical event metadata for
   **14 days**, with automatic expiry. Record errors, durations and opaque job IDs;
   no message bodies, documents, transcripts, audio, credentials, invite tokens or
   full signed URLs. Sanitize provider errors and request logging at API/worker layers.
   This policy does not shorten user-owned chats/memories/change history,
   consent receipts or cost/billing records, which need their own stated retention.
   Validate vendor logging controls separately; do not promise control over a vendor's
   retention before inspecting it.
4. **Human support access:** no routine human browsing of private chats/uploads.
   Users can report a problem and preview/select the specific messages or files
   shared with support. Access is limited to assigned support reviewers, logged and
   revocable for future access. Automated risk events log minimal metadata, not an
   automatic raw-conversation feed to staff. This decision refines §12's earlier
   "flag & review" wording: a safety flag alone does not authorize reading private
   content. Support-case retention and access for exceptional incidents require an
   explicit documented policy; do not imply a continuously monitored crisis service.

All four above were approved. Paid price is deferred until measured beta usage;
backup purge timing, support ownership, provider-side retention and concrete deployment
sizing remain operational follow-ups. Paid 5 GB is a per-user quota, not a shared pool.

## 20. Navigation, cross-relationship advice, translations and support retention — DECIDED

1. **Navigation:** start with **Home, Relationships, Growth, Bartender and Settings**.
   Home shows the check-in inbox and upcoming items. Relationship pages hold their
   shared timeline, memories and dates; solo/private content stays accessible without
   adding a relationship. This is a first screen map, not a final visual design.
2. **Cross-relationship advice:** default each relationship conversation to its own
   eligible context. An explicitly requested personal overview can draw from more
   than one relationship only after the user selects which to include, subject to
   all existing item/category/provider permissions. Never reuse one relationship's
   private material in another relationship's shared output. This adds a selection
   flow for private overviews, not a relaxation of the existing context boundary.
3. **Translation workflow:** keep the seven launch-language catalogs versioned in Git,
   use AI-assisted drafts plus native-speaker review, and defer buying a translation
   management service until needed. Safety copy retains the already required
   professional verification before release. This revises the earlier assumption
   that an external TMS is required for launch; it does not reduce review standards.
4. **RTL timing:** ship the seven current left-to-right locales first, using direction-
   aware layouts and logical spacing from the beginning. Add fully tested RTL
   interface locales when an RTL language is added. Preserve correct mixed-script
   rendering for user text now, without claiming full Arabic/Hebrew UI support.
5. **Support-report content retention:** delete user-selected messages/files copied
   into support cases **30 days after closure** by default; deleting the user's source
   or revoking support access earlier must stop future reviewer access. Keep only
   minimal non-content incident metadata under a separately stated retention rule.
   Reopening before purge updates closure timing; reopening after purge cannot restore
   deleted attachments. Do not alter the user's original journal/chat retention.
   Document any exceptional preservation policy explicitly rather than silently
   keeping support content indefinitely.

All five above were approved. **German is also a launch locale**, bringing the total
to seven: Italian, Spanish, Korean, Mandarin, Cantonese, English and German. Apply the
same UI, fallback, safety-copy, OCR/STT and model-quality review requirements to German.
These changes do not authorize scaffolding; planning continues.

## 21. Encryption, 2FA, Drive import and gallery storage — DECIDED

1. **Encryption model for the first version:** encrypted transport and managed
   encryption at rest, plus strict server-side access controls; authorized backend
   processing can read content to sync/search and perform approved AI tasks. Approved
   processors receive the minimum readable context needed. Do not claim end-to-end
   encryption: keys exclusively controlled by users would require a different AI,
   search and recovery architecture. Verify actual service/key/backup settings before
   launch. Local PIN lock and redaction do not themselves provide end-to-end encryption.
2. **Two-factor authentication:** offer optional authenticator-app 2FA for users,
   and require strong 2FA for administrative/support accounts. Plan recovery codes/
   recovery flow and device/session revocation; validate exact platform capabilities
   before implementation. App PIN/biometric lock remains a separate device feature.
3. **Google Drive import:** start with a one-time import of files explicitly selected
   by the user, using a picker and the narrowest workable permissions. No whole-Drive
   scan or continuing sync. Use the normal private ingestion, untrusted-data, OCR and
   source-retention paths; never delete or modify the original Drive file. Later edits
   in Drive do not update an imported snapshot until the user imports it again.
   Google sign-in alone does not authorize Drive access.
4. **Gallery-memory storage:** count deliberately saved photos/videos/audio memories
   in the same tier's original-file byte allowance (free 50 MB, paid 5 GB), but never
   apply the context-source 30-day expiry or oldest-first removal to these memories.
   When adding a memory, expired/eligible context originals may be reclaimed under
   the free policy; if remaining space is insufficient, pause new original storage
   and offer user-directed cleanup/upgrade. Existing memories stay intact.
   For downgrade, preserve memory originals and pause new storage if they alone exceed
   the free allowance; do not silently delete memories to fit. This is an explicit
   exception to context-original cleanup, not indefinite paid-feature entitlement.
   Account deletion and user deletion still remove owned memory originals. Clarify
   the exception in storage UI and measure its cost before broad commercial release.
**Approval status:** decisions 1–4 above are approved. Analytics was developed
separately: its scope (§22) and settings (§23) are now approved. Product analytics
still requires the end user's opt-in; project approval is not user consent to tracking.

## 22. Analytics — three separate areas (DECIDED scope)

**A. Personal insights — private to the user**
- Help the user reflect on their own goals/habits, self-reported mood and check-in
  helpfulness. Charts and summaries use only their authorized records; no member
  receives another person's activity dashboard, prompt outcomes or private source data.
- Optional AI interpretation is a separate user action/consent, respects saved-context
  switches, per-item exclusions and approved providers, and links to eligible sources.
  It must not diagnose, rank people or treat inferred emotions as reported facts.
- Users may deliberately share a resulting summary through the existing item/recipient
  model. Sharing that artifact does not grant access to the dashboard or underlying
  private inputs. Keep source restrictions and unsharing behavior intact.

**B. Product analytics — separate developer/admin view**
- Understand onboarding, feature usefulness and notification burden without collecting
  private content. Candidate events: onboarding complete, check-in answered/skipped,
  reminder frequency reduced, notifications disabled and optional helpfulness feedback.
- No message/document/transcript bodies, screenshots, names, relationship identifiers,
  mood values or saved memories in the product event stream. Do not scrape private
  records to reconstruct events or automatically export private personal charts.
- Prefer helpfulness and reduced reminder burden to raw time-in-app/message volume.
  Self-reported benefit is a signal, not proof of relationship improvement. Define
  analytics consent, identity granularity, retention and permitted properties explicitly.

**C. Operations and costs — service administration**
- Track delivery failures, latency, processing errors and AI cost by task/provider.
  Reuse minimized diagnostic events (§19) and the usage ledger (§16), not private text.
  Separate technical logs, cost reconciliation and product event stores/permissions.
- Keep the EUR 20 budget path reliable even when optional product analytics is off.
  The agreed 14-day diagnostic-log retention remains unchanged; it does not imply
  the same lifetime for billing records or optional product events.

**Architecture and phasing**
- Personal records/read models and product events are separate schemas/tables and
  authorization paths. Admin access to aggregate product metrics never grants access
  to private personal dashboards. Do not label pseudonymous event streams anonymous.
- Instrument minimal technical/cost events with the first loop; add private progress
  views as goals/moods are built and expand insights later. Optional product tracking
  follows §23's approved consent/event design and remains off until each user opts in.

## 23. Analytics consent, hosting, retention and personal insights — DECIDED

1. **Product analytics consent:** opt-in, off by default, independently from personal
   insights and AI-context consent. Core app/personal charts work without it. Withdrawal
   stops new optional events and clears unsent batches; do not backfill past private
   activity after opt-in. Existing attributable-event deletion needs an accessible
   control and follows account deletion, rather than silently continuing retention.
2. **Analytics hosting:** start inside our European Supabase project with separate
   event tables and restricted aggregate admin queries. No third-party analytics SDK
   or new processor initially. Use narrowly scoped pseudonymous analytics IDs only
   where funnel measurement needs them; no relationship IDs, content IDs or email.
   Aggregation should avoid exposing an individual tester's behavior through filters.
3. **Product event retention:** keep consented pseudonymous events for **90 days**,
   then delete them; keep only non-identifying daily/cohort totals for **12 months**.
   Suppress low-count slices and granular dimensions that could identify a tester;
   small-beta cohort views can be withheld rather than pretending they are anonymous.
   These periods do not change the 14-day technical logs or private until-deleted history.
4. **Personal insights default:** start with factual goal/habit progress, self-reported
   mood trends and the user's own check-in/helpfulness history. No automated diagnostic
   or relationship-health score. AI interpretation is requested/approved separately,
   with visible sources and all existing context/processor restrictions; opting into
   product analytics never opts into private-text analysis or vice versa.
5. **Interaction recording:** no session replay, screen recording or keystroke capture
   for analytics, including during beta. Use content-free events and user-submitted
   support reports to diagnose usability issues. Disable inherited automatic form/
   input collection and crash-report attachments that could capture sensitive screens.
   A future recording feature would require a separate explicit decision.

All five above are approved planning decisions; no analytics implementation exists
yet. Product analytics is opt-in and never a prerequisite for basic app access.
Provider configuration, backup purge verification, reviewer assignments and deployment
sizing remain implementation/release verification work.

## 24. Onboarding, pause/snooze, channels, audiences and streaks — DECIDED

Core architecture, storage and analytics choices are settled. These are bounded
interaction defaults, not a requirement to invent six more features before building.

1. **Progressive onboarding:** collect sign-in, display name, language and timezone
   first; offer a correctable country for local help. Relationship creation is optional.
   Ask for push/microphone/Drive and provider permissions when the user first invokes
   the relevant feature, not as a mandatory wall of setup questions. Optional context,
   analytics and personal-profile answers stay skippable.
2. **Pause reminders:** let users pause their proactive prompts for **today, one week
   or until resumed**, globally or for a selected relationship. This is distinct from
   archive/leave/block and does not silence ordinary member messages. Stop affected
   pending scheduled work, including sends on their behalf; resume without replaying
   missed prompts. Never pause another member's preferences or interfere with static help.
3. **Snooze an individual check-in:** offer **1 hour, 3 hours or tomorrow**, with a
   custom time option. Snooze suspends the current approval timer and automatic send;
   on resurfacing create a fresh decision window using current consent/preferences,
   not an expired deadline. Respect quiet hours, pause state and the user-level cap.
   Do not blindly send an old time-sensitive draft without revalidation.
4. **Multi-channel reminders:** choose one primary channel per reminder type, with
   only explicitly enabled delivery fallbacks. Do not broadcast the same nudge to
   every connected channel by default. The in-app inbox remains the canonical view;
   cross-channel duplicates must not consume multiple approvals or cause double sends.
   Transport fallback still requires recipient/channel authorization and quiet-hour rules;
   it is separate from AI-provider fallback.
5. **Group sharing audience:** preview the exact eligible recipients before sharing,
   including shared plans. Respect pairwise blocks and item exclusions per recipient;
   never silently expand to all members or disclose another user's block settings.
   If the chosen audience cannot be delivered as requested, ask the sender to revise
   it instead of silently pretending everyone received the same item. B/C-only plans
   remain available when A blocks B. Store recipients with the resulting artifact.
6. **Streak experience:** private, optional and encouraging. Show personal consistency
   and completed actions, with pause/rest days; avoid guilt, partner comparisons or
   punishment for missed days. A skipped prompt is not evidence of neglect or poor
   relationship health. The user can hide streak displays without disabling goals
   or useful reminders. Product analytics never exposes individual streaks to members.

All six above were approved. These are defaults for their relevant phases; they do
not pull later channels, shared plans or richer growth features into Phase 1.
The first implementation plan remains bounded by Phase 0/1; construction still
requires user approval of that implementation plan.

## 25. Context formats, limits, extraction, plans and test data — DECIDED

1. **Initial context file types:** PDF, DOCX and plain text for documents; JPEG, PNG
   and WebP for screenshots/images. Voice uses the separate recording/transcription
   path. Reject unsupported formats clearly before processing rather than claiming
   successful extraction. Image-only PDFs go through OCR. Uploaded gallery media can
   have a separate supported-type list; video transcription and HEIC conversion are
   later capabilities, not implicitly included in this first extraction list.
2. **Ingestion limits:** begin with **20 MB per file and 10 files per batch**, enforced
   server-side and configurable. Processing limits are distinct from free 50 MB/paid
   5 GB retained storage and the AI budget. Use direct authorized storage uploads;
   validate actual file type, extraction page/text bounds and available budget before
   processing. Stage work within bounded temporary storage, not unlimited batch
   concurrency. Larger-file support can follow measured demand and provider tests.
3. **Voice-note duration:** **5 minutes per recording** initially, with a visible
   countdown, stop/cancel controls and an explicit microphone permission. Stop at the
   limit; no background/ambient recording. Preview/edit the transcript before send or
   save. Default audio discard and tier-based keep-original rules remain unchanged.
4. **Extraction review:** show the extracted text and source reference before it is
   accepted into saved AI context, with correction and retry controls. Save user
   corrections as a separate text revision linked to the source, not a fabricated
   alteration of the original document. OCR output remains untrusted data. Retaining
   a source or reviewing text never overrides saved-context/provider permissions.
5. **Shared-plan responses:** each invited participant controls their own **accept /
   decline / tentative** response. Silence stays pending. Neither the organizer nor
   the bartender can accept for someone else. Changes to time/participants require
   notifying eligible affected participants and reconfirming material changes; preserve
   the pairwise block/audience rules. This is a later shared-plan feature, not a
   requirement to introduce messaging/calendar scope in the first loop prototype.
6. **Notification denial:** keep the app fully usable through its in-app inbox if
   push permission is declined. Show a settings link when relevant, not repeated OS
   permission prompts. Never silently substitute SMS/email/another channel; fallback
   must already be explicitly enabled. Do not characterize missing push permission
   as failure to care for a relationship or penalize goals/streaks.
7. **Test and preview data:** use fictional seed data and mocked providers by default
   in local development/preview deployments, with explicit opt-in for bounded live
   provider smoke tests. Isolate preview credentials/state from real beta accounts;
   previews must not dispatch real messages or spend from a production key by default.
   Before beta, validate web + a real Android device and meaningful tests for private
   access, block/unshare gates, duplicate delivery, worker recovery and budget limits.
   Test the seven locales; this is a verification plan, not a claim tests exist yet.

All seven above were approved. Upload/voice/shared-plan details belong to their
planned feature phases, not Phase 0/1 by default. The first build plan should name
its acceptance tests and stop at the agreed auth/check-in scope.

## 26. Sessions, delivery, dates, calendar, goals, accessibility and appearance — DECIDED

The core product and architecture choices are settled. These are remaining account
and interaction defaults for their feature phases, not ten additional prerequisites
for writing the first implementation plan.

1. **Device/session management:** show the user's active sessions with device/browser
   labels and last-used time, and offer revoke-this-session / sign-out-other-devices.
   Do not expose another member's devices, online status or location. Revocation must
   be enforced for sensitive server operations, not just clear one browser's UI.
2. **Travel/timezone changes:** detect a changed device timezone and offer a switch;
   preserve the saved timezone until confirmed. Show the timezone on scheduled items.
   Keep local quiet hours consistent across daylight-saving changes, without duplicate
   dispatch for repeated clock times. No location tracking is needed for this.
3. **Cancelling scheduled messages:** show the scheduled audience, channel, content
   and send time in a private pending list, with edit/cancel until dispatch is claimed.
   Cancel atomically against worker execution. Clearly distinguish a cancelled job
   from a provider request already accepted; do not promise recall after delivery.
   Existing skip-by-default, approval windows and per-item overrides remain unchanged.
4. **Delivery failures:** show pending/sent/failed (and delivered only with reliable
   provider evidence). Use bounded retries only for retryable failures; a provider
   timeout with unknown acceptance must not trigger an automatic duplicate send or
   cross-channel resend. Keep the failure in the private inbox and offer an informed
   retry. No silent promotion to a more expensive channel or unapproved provider.
5. **Important-date defaults:** support one-time and yearly dates, with an editable
   **7-day / 1-day / day-of** reminder preset. Dates are private
   until explicitly shared. Date nudges obey quiet hours, pause and the user-level
   proactive cap; group/coalesce rather than add unlimited alerts. Pick a local
   reminder time visibly rather than interpreting every date as a midnight notification.
   Calendar systems/complex recurrence beyond the initial date model can follow later.
6. **Google Calendar scope:** start with opt-in publishing of chosen app dates/plans
   into a dedicated app calendar, not reading/analyzing unrelated personal events.
   Authorization is separate from Google sign-in; use the narrowest workable scope
   and validate it during integration. Do not invite external attendees without an
   explicit recipient action. Updates/cancellations apply only to app-owned records;
   disconnect stops future sync without claiming recall of external copies. Later phase.
7. **Growth goal types:** initially support recurring daily/weekly habits and one-off
   milestone goals. AI can propose a goal/plan, but the user accepts its wording and
   schedule before activation. Participants update only their own progress; define
   shared milestones explicitly rather than letting the AI mark another person done.
   Personal goals stay private unless shared through recipient grants. Later phase.
8. **Accessibility baseline:** design keyboard navigation, screen-reader labels,
   visible focus, scalable text, adequate contrast and reduced-motion behavior from
   the first screens. Test these on web and Android; seven-locale layouts must not
   rely on fixed text heights or color alone. This is an engineering acceptance target,
   not a claim of certified conformance without an audit.
9. **Appearance:** start with system-following light/dark themes and a manual override,
   reusing/adapting SchedaPRO nightshift tokens. Contrast and focus visibility must
   work in both themes; visual design should suit this app rather than retain fitness
   copy. Theme selection must not change language, privacy settings or AI personality.
10. **Quick-exit behavior:** provide a visible fast exit from sensitive screens to a
    neutral app view and clear previews/sensitive screen state. If device app-lock is
    enabled, require unlock before reopening protected content. Do not claim to erase
    browser/OS history, notifications or screenshots outside the app's control. Preserve
    the user's data; quick-exit is not deletion or a notice to other members.

All ten above are approved. Routine remaining engineering choices are approved by
delegation under §27. Owner-sensitive choices and setup facts are distinguished there;
there is no requirement to keep producing additional numbered decision batches.

## 27. Decision closeout — delegated defaults and the finite owner review list

**Authority:** the user approved every decision in §26 and authorized choosing the
remaining routine defaults. This section supersedes stale "open/proposed" labels in
the earlier planning walkthrough. Already approved privacy, inclusion, safety, storage,
blocking, localization and phasing rules are not reopened. User instructions take
precedence over defaults. This closes the rolling decision questionnaire.

**Historical closeout scope:** §27 originally covered planning only. The later
explicit implementation instruction in §28 supersedes that restriction for local
scaffolding/development; paid provisioning and real-data activation still have gates. The next concrete engineering
artifact is the bounded Phase 0/1 implementation plan, rather than more invented
batches of feature questions. Later feature design stays in its assigned phase.

### A. Routine defaults — APPROVED BY DELEGATION

These are selected engineering defaults, not claims that the user named each detail.
Change them autonomously when evidence requires, provided behavior, privacy, cost
permissions and the owner's material choices are preserved; document the reason.

| Area | Adopted default |
|---|---|
| Reuse baseline | Copy/adapt bounded files from SchedaPRO main; take reviewed settings/theme work from nightshift and routing patterns from PLT. Preserve source repos and never point this app at their live APIs or data. |
| Project layout | React/Vite/TS client, FastAPI request layer and reusable worker modules with explicit shared domain contracts. Do not migrate to a different framework just for convenience. |
| Dependency/tooling | Reuse compatible sibling manifests/lockfiles, pin reviewed versions, use its package-manager/test conventions. Verify platform APIs before implementation; no blind SDK upgrades or downloads during planning. |
| Localization | i18next/react-i18next, seven Git catalogs, English source keys, Intl date/number formatting, native review plus professional safety-copy review. Provider quality must be tested per language. |
| State and access | Supabase is authoritative. Separate private ownership, explicit item-recipient grants, membership, pairwise blocks, archived_at, and capability-scoped provider/context consent. Avoid redundant flags as authorization. |
| Durable jobs | Start with a Postgres jobs table and transactional lease/claim functions, not an extra queue service. Supabase dispatch creates due work; Frankfurt worker executes it; Vercel handlers create/read jobs. |
| Tick/cadence semantics | Tick every minute for due/expiry work, not per-second precision. Default cadence is six elapsed hours with presentation confined to waking windows; defer/coalesce missed slots rather than accumulate a catch-up backlog. Keep cadence/quiet hours/cap configurable. |
| Lifecycle | Versioned decisions with pending/deferred/queued/fulfilled/skipped/cancelled/failed/uncertain outcomes. Skip is not success. Single artifact per check-in, separate recipient delivery attempts. |
| Safe retries | Initially up to three attempts for demonstrably safe retryable work with backoff and jitter. Each paid attempt reserves budget. Unknown outbound acceptance is held for reconciliation; it is never an excuse for an automatic duplicate. |
| Batching/concurrency | Small bounded worker batches initially; one active claim per job. Rate-limit by task/user/provider and tune from measurements, keeping the accepted per-user reminder cap separate. |
| Honest degradation | Use the localized bar-closed outage notice only for an actual provider outage. Distinguish budget exhaustion, missing approval and unsupported capability with accurate static wording/actions; do not falsely report that the API is down. Static help remains accessible. |
| Model/OCR configuration | Keep concrete model IDs and prices in server configuration; select the least-cost capable approved route that passes language/tool/safety evaluations. Prefer existing provider adapters; activate no extra processor implicitly. No hardcoded "Flash/Pro" product-name promises. |
| Reminder presentation | Approval starts when eligible content becomes available in the inbox/presentation path, not when generation starts and not based on an unobservable claim that a notification was read. Quiet hours, snooze and pause control when the window starts/resumes. |
| UI defaults | Existing five-tab navigation, system theme/manual override, responsive layouts, accessible controls, plain status copy and content-free push previews. No new social feed, ranking or surveillance features. |
| Local cache | User-scoped IndexedDB/cache for eligible data and offline drafts; minimal private thumbnails; protected platform session storage where supported. Clear accessible account cache on logout/revocation and reapply tombstones at sync. Disclose that offline copies cannot be remotely recalled instantly. |
| Storage accounting | Decimal MB/GB displayed consistently; server-authoritative reservations for originals/gallery. Context expiry cannot remove gallery memories or extracted text. Temporary processing and export files have their own bounded cleanup. |
| Temporary/export cleanup | Stage processing audio/files only as long as needed, with a 24-hour maximum orphan-cleanup target; user cancel/deletion removes earlier where possible. Private generated export bundles expire after 24 hours. These app-side targets are not provider backup-purge guarantees. |
| Account safety | Current authorization and revocation checks for sensitive operations, explicit reauthentication where required, tested recovery flow, no AI access to auth/session secrets. Never silently merge separate accounts or consume an invite on sign-in alone. Validate actual auth-provider linking behavior before enablement. |
| Destructive actions | Delete only content/records the actor owns or has explicit authority to delete. A relationship creator cannot wipe other members' accounts, private records or unrelated B/C activity. Group deletion is not an AI shortcut. |
| Audit minimization | Keep user-visible action/source revision history privately under its own retention, without auth secrets or duplicated whole-document bodies. Do not use it to bypass original/text deletion. Diagnostic logs retain 14 days; consent receipts and cost ledgers have separate purposes. |
| Operational record lifetime | Keep current consent state while the account exists and minimal superseded consent/access events for 90 days; detailed app cost reconciliation records for 90 days, then non-identifying monthly totals for 12 months. Do not overwrite the separately agreed product analytics periods. Payment/invoice retention is specified before future billing, not inferred from these app defaults. |
| Backups and restores | Maintain separate recovery plans for database records and original file objects. Replay deletion/revocation records before reopening a restored system; never resurrect sent jobs or re-enable revoked provider consent. Verify actual plan-level backup retention/location and file backup coverage before storing real beta data. No paid backup upgrade is purchased by this planning decision. |
| Testing | Reuse existing lightweight frontend/backend test patterns; add meaningful contract/access/state-machine/worker tests, browser checks and real Android checks. Fictional seeds/mocked providers by default; live smoke tests bounded and explicitly enabled. |
| Release hygiene | Separate preview and beta secrets/state, reversible migrations and measured rollout. Verify backup/restore, access controls and seven-language critical flows before beta. Never interpret a successful build as a tested live deployment. |
| Integration rollout | Push/in-app first; uploads/advisor/Drive/voice/growth and later channels remain in their feature phases. No channel registration, automated external send, paid vendor plan or new cloud processor is enabled by default. |
| Scope/limits | Implement exactly the agreed first slice before expanding. Enforce ingestion, cost and abuse controls without deleting retained user text to solve a budget problem. Storage space and model/processing quotas remain separate concepts. |

### B. Owner-sensitive choices — the complete current review list

These can materially change identity, outward behavior, spending or data exposure.
They are not automatically converted to consent by the blanket approval of routine
choices. No repeated numbered decision batches are needed; keep these six on one list.
Defaults below allow planning/prototyping to proceed without inventing a final answer.

| ID | Choice the owner may want to change | Safe planning position / recommendation | When needed |
|---|---|---|---|
| O1 | Public app name, bartender name and final visual identity | Keep `saymynamesaymyname` as a working repo title, a nameless friendly bartender and an accessible warm light/dark draft. No personal photo as a public brand asset without instruction. | Before public/store identity; not before a prototype. |
| O2 | Recipient-facing AI attribution | Recommend an AI/app-assisted label on messages sent automatically; reviewed drafts may be sent as the user's approved content. Do not expose private prompt history, skips or edits. Exact recipient wording remains owner review. Never impersonate another person's account or imply a human approved an automatic message. | Before outward automatic sending. |
| O3 | Multilingual outward-message behavior | Recommend showing/approving the exact translated variants per recipient, preserving access to the original and labeling translations. Until chosen, send only explicitly approved wording; no silent post-approval rewriting. This is distinct from native-language advisor text. | Before multilingual member messaging. |
| O4 | Total ongoing infrastructure/storage budget | EUR 20/month remains AI-only. Present a concrete hosting/storage/backup quote and total limit before starting paid services. Small beta size and free allowances do not establish an overall hosting budget. | Before paid provisioning or increasing allowances. |
| O5 | Public paid price and included AI/processing allowances | Keep beta free/no real billing. Maintain 50 MB free / 5 GB paid storage entitlements and agreed retention. Use measured usage to propose price, AI allowances and additional storage tiers; do not promise unlimited AI. | Before accepting payments, not before beta development. |
| O6 | Approval of actual cloud-processor data terms | Verify each chosen processor's processing regions, retention/training settings and capabilities; present the material facts before activation. Frankfurt storage is not a promise of EU-only AI processing. Until verified/approved, use mocks or already authorized processing only. | Before sending real content to that processor. |

The user subsequently adopted O2/O3 recommendations for now (§28), preserving the
recipient-content privacy model; branding and pricing stay deferred. O4/O6 need real facts/amounts; a generic "yes" is
not substituted for an actual quote or provider data review.

### C. Setup facts and release evidence — not product preference questions

- Select the owner's actual Vercel/Supabase/Render accounts/projects and configure
  scoped keys/secrets directly in secure setup; never invent or request pasted keys.
- Supply a real monitored support address and assign support/security ownership;
  choose actual native-language/safety-resource reviewers before publishing their work.
  No person or response time is represented as staffed until confirmed.
- Configure Android package/signing, OAuth/deep-link domains, email delivery and
  native push credentials; verify the registered identities/redirects before release.
- Verify actual model availability/prices, OCR/STT coverage for all seven languages,
  selected plan limits, budget-control behavior and backup/file recovery coverage.
- Obtain evidence from safety/access tests, restore/delete drills and real-device
  behavior. Resource entries have checked sources/review dates; no invented hotlines.
- These tasks cannot be "approved into existence". They are completed when facts and
  test evidence exist. Missing public contact/reviewer assignments need not stop a
  local fictional-data prototype, but do block claiming those services are available.

### D. Approved scope for drafting the implementation plan

Phase 0/1 only: client shell and locale plumbing, auth, solo onboarding, optional
relationships/approved invites, permission schema, preferences, one durable AI
check-in, approve/edit/skip/snooze, resulting private/shared artifact, in-app inbox,
Android push, minimal job/cost/status views and the necessary settings/access controls.
Start with mocks/fictional data; validate live processing only after its prerequisites.
Uploads, full bartender chat/tools, richer goals, plans, media and external channels
remain later phases; initial navigation can expose clear placeholders, not fake features.
No live provider, billing, backend project or native package is created in this update.

Documentation references checked 2026-11-14:
- React i18n binding: https://react.i18next.com/
- Database/object recovery distinction and plan-specific retention:
  https://supabase.com/docs/guides/platform/backups
- Infrastructure metering/budget controls: https://vercel.com/docs/spend-management

## 28. Phase 0/1 execution authorization

The user requested a concrete Phase 0/1 implementation plan and continuation without
another permission stop. Execute `docs/implementation/PHASE-0-1.md`, beginning with
local fictional data and mock processors. O1 branding and O5 pricing remain deferred;
O2/O3 recommended attribution/translation defaults are adopted for now. O4 actual
hosting budget and O6 actual processor data terms remain configuration/activation gates,
not blockers to local implementation. Earlier planning-only stage instructions are
superseded by this explicit user request. Record actual progress in CURRENT-TASK.md.


## Phase 0/1 implementation: explicit reflection grants

Saved reflections remain private originals. The first sharing slice exposes only
immutable copies to an owner-selected, previewed list of recipients. Permission is
read-only; it grants neither delegation nor AI processing. The live server checks
membership version, reachability and pairwise blocks before creating any grants.
A failed recipient check rejects the entire proposed audience.

Previously received snapshots survive leaving/personal archive/mute; they never
follow later private edits. Explicit revocation removes future server access even
after departure. A pairwise block terminates that pair's existing snapshot grants
across spaces, with no effect on other pairs; unblocking requires a fresh explicit
share to grant access again. Source deletion cascades through its snapshots/grants.
Backend denial is immediate. Already rendered text clears on refresh/visibility
changes and the 15-second polling cycle; external copies cannot be recalled.

Scope/evidence and remaining cross-content work: docs/implementation/SHARING.md.


## Durable cloud implementation checkpoint — 2026-11-15

Four code milestones now cover private queue leases/idempotency; opt-in schedule
settings with quiet hours/DST/local caps/fair due scans; the restricted Frankfurt
worker runtime; and recovery, one-minute hosted cron, readiness and Settings UI.
Mock-only composition remains deliberate. All schedules start disabled. Queue
completion creates a private draft; only explicit user approval creates an entry.
No provider access, shared recipient grant or outward send is implied.

Hosted migrations/cron and rolled-back synthetic smoke are verified. Actual Render
compute/credentials and production restricted-login connection remain unverified.
The instant preview path stays usable during this activation boundary. See
CURRENT-TASK.md and docs/implementation/CLOUD-SCHEDULING.md for tests and gates.
