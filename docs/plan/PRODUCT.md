# Product and the check-in loop

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-1"></a>

## 1. The idea in one sentence

A personal app that helps you **grow** (goals, habits, an AI advisor) and, **for any
relationships you choose to track**, **proactively prompts you to connect** on a
cadence you set — quietly accumulating a record (messages, moods, memories, photos)
as a byproduct.

The check-in loop is the engine. Two pillars sit on it: **personal growth** (goals,
habits, profiles, advisor — §3c) which works on its own, and **relationships**
(check-ins, shared memories) layered on top for those who want them. Journal, dates,
and photos are what the loop produces and draws from — not separate features bolted on.

<a id="section-1a"></a>

## 1a. Core assumptions — inclusive by design (FOUNDATIONAL)

These shape the entire data model and copy. Non-negotiable:

- **No assumption the user is in a relationship.** A solo user is a first-class,
  complete experience — the growth pillar (§3c) stands fully on its own.
- **Any number of relationships.** Zero, one, or many. A user belongs to 0..N
  relationships; the app never implies they should have exactly one.
- **Relationships aren't only two people.** A relationship has **1..N members, including the user**. Other members may
  join later; polyamory and non-dyadic structures are supported. Never hardcode
  "the two of you."
- **No assumptions about gender, orientation, or relationship structure.** LGBTQA+
  and non-traditional relationships are fully supported. Copy is **neutral and
  affirming**; no gendered defaults, no heteronormative framing.
- **The user names and defines each relationship** (label, who's in it, type). The app
  adapts to them, never the reverse.

> Terminology: a **relationship** is a user-defined tracked connection with
> 1..N members, including the user. A **member** is a person in it. **Partner**
> never implies a romantic, gendered or dyadic structure. Solo use is complete.


---

<a id="section-2"></a>

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

<a id="section-2b"></a>

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

<a id="section-2c"></a>

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

<a id="section-3c"></a>

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

<a id="section-3"></a>

## 3. Supporting features (serve the loop)

- **Relationships** — the user defines 0..N relationships, each with 1..N members,
  optionally inviting them via link; all relationship data is scoped per-relationship.
- **Journal / notes** — entries (text, mood, date). Many entries are *generated by*
  check-in responses; can also be created manually.
- **Important dates** — anniversaries/birthdays/milestones; feed reminder crons and
  give the compose step material ("Your anniversary is in 7 days — plan something?").
- **Photos & media** — attach to entries or stand alone; surfaced in digests/recaps.

---

<a id="section-4"></a>

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
