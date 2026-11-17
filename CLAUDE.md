# CLAUDE.md

Guidance for working on this project.

## Current stage: IMPLEMENTATION — Phase 0/1 authorized

The user requested the Phase 0/1 implementation plan and explicitly instructed us to
proceed without another permission stop. Execute `docs/implementation/PHASE-0-1.md`.
Use recommended defaults; branding and pricing are deferred. Mock/fictional local
work, scaffolding and dependency installs are authorized. Follow accepted safeguards;
verify live processor terms/credentials and actual hosting costs before real-data or
paid provisioning. Record honest milestone status in CURRENT-TASK.md. Do not confuse
local demo completion with Supabase authentication, RLS, native push or beta readiness.

## What the app is

A mobile app for **personal growth and relationship management**. At its core it is a
**multi-channel, AI-driven check-in engine**. It works **standalone for a solo user**
(growth pillar) and lets the user track **any number of relationships** on top.

## Sibling codebase: ./schedapro (reuse freely)

`./schedapro/` is **our own code** (we built it) — third in the family **PLT (legal) →
SchedaPRO (fitness) → this (relationships)**, which recycles infra and swaps domain.
**Copy/lift/rewrite snippets, files, or whole folders freely** — no licensing concern.
Strong reuse candidates + domain mapping live in `PLAN.md` §13. Map: *scheda cliente*
→ per-relationship page; *Aria* → the bartender; engine = **DeepSeek primary, Anthropic
fallback**.

**GUARDRAIL RULE — never downgrade.** Our `PLAN.md` §12 guardrails are stronger than
SchedaPRO's. When porting code, keep our guardrails on top; if ported code conflicts
with §12, §12 wins. Don't inherit the sibling's lighter safety posture.

**Client stack — DECIDED (2026-11-14): React + Vite + TypeScript + Capacitor.**
Reuse SchedaPRO components and infrastructure, adapting them to our domain and §12
safety rules. This supersedes Expo/RN. Reuse FastAPI too; Vercel web/request hosting is decided, Frankfurt processing worker with durable Supabase jobs is decided.
See `PLAN.md` §13 and the pre-build decision list in §14.

## Inclusive by design (FOUNDATIONAL — never regress)

- Never assume the user is in a relationship. Solo is a complete, first-class experience.
- A user has **0..N relationships**; each relationship has **1..N members** (supports
  polyamory / non-dyadic structures). Never hardcode "two people" or "a couple."
- **No assumptions about gender, orientation, or relationship structure.** LGBTQA+ and
  non-traditional relationships fully supported. Copy must be neutral and affirming.
- The user names and defines each relationship. See `PLAN.md` §1a (authoritative).
- **Enforce in the AI too**: these invariants live in a centralized system-prompt core
  prepended to *every* AI-provider call (check-ins, advisor, digests). The model must mirror
  the user's own terms (names, pronouns, labels), never guess. See `PLAN.md` §9.

## Decisions made

- **Initial check-in approval preset:** skip after 30 minutes; action and window
  remain overridable per channel and per check-in. Silence never enables auto-send.
- **Initial cadence/quiet hours:** 6 waking hours; 22:00–08:00 local quiet hours,
  editable. Defer nudges without a morning backlog burst.
- **Notification previews:** discreet by default, with explicit opt-in to details.
- **Initial access:** invite-only beta; beta admission is separate from relationship
  invitation approval and acceptance.
- **Offline:** cached reading and personal note drafts/edits; online authorization
  required for shares/invites/sends, no automatic sending of drafts on reconnection.
- **Fatigue cap:** default 3 proactive nudges per user/local day across relationships
  and solo growth, editable; ordinary incoming messages and user requests excluded.
- **Device lock:** optional PIN/biometric, offered at onboarding, 5-minute idle timeout
  when enabled. Keep notifications discreet even when lock is disabled.
- **Account deletion:** Settings with final confirmation and prior export option;
  stop jobs, revoke sessions and delete owned live data/derived context. Explain
  backup purge and shared-copy limits; never expose deletion as an AI tool.
- **Conflicting edits:** preserve both versions for owner resolution; do not overwrite
  edits or resurrect deleted records silently.
- **Unsharing:** immediately revoke live item access, pending delivery and future AI
  reuse, including for departed members. Cannot recall independent downloaded copies.
- **Action gates:** independently check automated outward sends/sensitive AI actions;
  hold if required checks are unavailable, with approved providers and budget gates.
- **Export:** authenticated private ZIP with readable text, JSON and retained originals
  currently accessible to the requester; source revocation applies to exports too.
- **Beta billing:** no real payments or auto-renewal; selected testers can receive
  dated paid-feature grants, with the agreed grace policy when access ends.
- **Diagnostic logs:** redacted technical metadata only, retained 14 days; no private
  text/files/audio/secrets. Cost, consent and user-owned history have separate rules.
- **Human support:** no routine browsing of private data; users select report content,
  with assigned, restricted, audited reviewer access. Risk flags alone grant no access.
- **Navigation:** Home, Relationships, Growth, Bartender, Settings; solo use never
  requires adding a relationship. Relationship pages hold their own timelines.
- **Cross-relationship advice:** separate context by default; explicit user selection
  for private multi-relationship overviews, without leaking into shared output.
- **Translations:** seven launch catalogs in Git, AI drafts plus native-speaker review,
  professionally verified safety copy; paid TMS deferred. Full RTL locales later,
  with direction-aware layouts/mixed-script content support from the start.
- **Support content:** delete report copies 30 days after closure; stop reviewer
  access earlier on source deletion/revocation. User originals keep their own policy.
- **Encryption model:** encrypted transport/managed at-rest encryption and server-side
  authorization; backend/approved AI processing can read authorized content. Do not
  claim end-to-end encryption. Validate actual service/key/backup settings.
- **2FA:** optional authenticator-app 2FA for users, required for admin/support;
  validate recovery/session handling separately from device PIN lock.
- **Drive import:** one-time user-selected files only, least workable permissions;
  no Drive-wide scanning/continuous sync or modification of the source file.
- **Gallery quota:** memories share free 50 MB/paid 5 GB original storage, but never
  auto-expire/evict, including on downgrade. Pause new storage when insufficient.
- **Analytics scope — DECIDED:** three separate areas: private personal insights,
  content-free product analytics, and minimized operations/cost reporting. Admin
  product metrics grant no access to personal dashboards. Helpfulness/reminder burden
  outrank raw engagement. Optional AI insights obey existing source/provider consent.
  **§23 analytics settings are decided:** optional product analytics opt-in/off by
  default; own European Supabase event store; events 90 days, non-identifying totals
  12 months; private factual insights with separately requested AI interpretation;
  no session replay/screenshots/keystroke capture. Small-cohort views are suppressed.
- **UX defaults (§24) — DECIDED:** progressive optional setup, pause today/week/until
  resumed, snooze 1h/3h/tomorrow/custom with suspended send timer, one primary reminder
  channel with opted-in fallbacks, explicit group recipient preview, private supportive
  optional streaks. No missed-prompt flood or default broadcast to every channel.
- **Ingestion (§25) — DECIDED:** PDF/DOCX/TXT/JPEG/PNG/WebP, 20 MB per file and
  10 per batch; voice recordings up to 5 minutes. Review/correct OCR before saving
  as AI context, preserving original/source revisions and existing consent gates.
- **Shared plans:** each person accepts/declines/marks tentative themselves; silence
  is pending. Material changes require reconfirmation; later feature phase.
- **Push denial:** in-app use remains available without nagging or silent SMS/email.
- **Test data:** fictional seeds/mocked providers for local/previews; bounded live
  tests explicitly enabled, isolated from beta accounts/production spend. Real Android,
  web, privacy/safety, worker recovery and budget checks required before beta.
- **§26 — DECIDED:** own-device sessions/revocation, confirmed travel timezone changes,
  private pending-message edit/cancel, truthful delivery/uncertainty states, editable
  7d/1d/day-of date reminders, opt-in app-owned Calendar publishing, personal habit/
  milestone activation, accessible UI, system/manual themes and neutral quick-exit.
- **§27 — delegated defaults:** Postgres jobs/leases, one-minute tick, bounded safe
  retries, i18next/react-i18next, isolated per-user caches and verified recovery. No
  skip-as-completed state or external exactly-once promise. Destruction is ownership-
  scoped; membership/creation does not authorize deleting other people's data.

- **Approach**: plan the full vision now, then build in **phases** (incremental).
- **North-star priority**: the **check-in loop** — timely, meaningful prompts that
  actually make the partners connect. Everything else serves this. When trading off,
  favor the check-in loop.
- See `PLAN.md` for the full, living plan.

## Safety is first-class (never weaken)

This app gives emotional advice, holds sensitive relationship data, sends on many
channels, and lets the AI act via tools — a high-risk surface. `PLAN.md` §12 is the
consolidated guardrails system (defense-in-depth). Treat these as load-bearing:
untrusted content (OCR/uploads/inbound) is **data, not instructions** (prompt-injection
defense); the app must **never enable coercive control/surveillance** of a partner;
crisis signals **drop the persona** and surface region-correct resources; cross-member
**private data never leaks**. Don't dilute these when implementing features.

High-severity protocols (§12): **self-harm**, **violence**, and **stalking** each have
explicit handling. Two rules that must be enforced **in code, not just by the model**:
(1) muted/left/personally archived recipients are unreachable in that relationship;
**blocks apply to the specific user pair only**. If A blocks B, B and C can still
communicate, share and make plans. No account or membership suspension. Gate sends
and automation server-side; no AI override. (2) **never build location
tracking of others**; support **discreet notifications + quick-exit** for victims whose
device may be monitored.

## Starting-point specs (provisional)

**Platform**
- React + Vite + TypeScript + Capacitor — shared web UI with Android/iOS wrappers.
  Validate native integrations per platform; no Expo-specific dependencies.

**Backend (decided direction)**
- Reuse/adapt SchedaPRO FastAPI. Dedicated Supabase project in Europe for Postgres,
  Auth and Storage in **Frankfurt (`eu-central-1`)**. **Vercel** is the chosen web
  host and target for suitable FastAPI handlers in Frankfurt (`fra1`). PLT's Vercel
  pattern is now selected: Frankfurt processing worker using Render, durable job
  state in Supabase. Supabase dispatch schedules; the worker executes; Vercel request
  handlers submit/read jobs. No duplicate scheduler or in-memory job authority.
- **Worldwide intended access**, retaining invite-only beta and seven launch languages.
  Country, language, regional resources and provider availability are separate (§15).
- **AI development/beta budget:** EUR 20/month target, excluding hosting/storage.
  Track all processor attempts centrally, reserve before calls and reconcile provider
  usage; no guaranteed invoice hard cap. See `PLAN.md` §16.
- **Sign-in:** email/password and Google for web/Android, with email verification
  and password recovery. Preserve invites through login, then require explicit join
  acceptance. Google identity sign-in does not grant Drive/Calendar access.
- **Web and Android first**; iOS testing/release later, retaining client portability.
- Initial languages: **Italian, Spanish, Korean, Mandarin, Cantonese, English and German**.
  Mandarin/Cantonese are distinct AI preferences; UI script is separate. Default to
  Mandarin/Simplified and Cantonese/Traditional; refine unset defaults from known
  country/region and device preferences. Explicit user choices always win; no GPS
  request solely for localization. Worldwide scope is decided; regional capability/resource coverage is tracked separately (§15).
- **Private cloud sync by default** across the user's devices for journals, chats,
  goals and uploaded/extracted context. Sync does not share with relationship members
  or grant AI-provider access; those permissions are separate.
- **Invite visibility:** members see only content explicitly shared with them. New
  membership never exposes private records or expands historical sharing audiences.
  Persist recipient grants; relationship membership alone does not grant content access.
- **Invitations:** any current member may propose; every current member must explicitly
  approve before the invitation is sent, and the recipient must accept to join.
  Enforce unanimity server-side; the AI cannot approve for anyone else. See §14.
  Approved invitations expire 7 days after sending, are single-use, and require the
  intended recipient's verified email plus explicit acceptance. Forwarding grants
  nobody else access; validate membership/approval versions again at redemption.
- **Personal archive:** scoped to the requesting user, preserves history, hides the
  relationship and pauses their check-ins/automated sends. Suppress sends to them
  in that relationship; other members keep their own settings. Store `archived_at`
  per membership, not a global archive flag. No missed-message replay on unarchive.
- **Leaving:** immediate, no approval. Stops future sharing and relationship messages
  to/from that membership; cancel queued work. Preserve own content and previously
  received history subject to retention/deletion, without access to later edits.
  Rejoining needs a fresh unanimously approved invite and recipient acceptance.
- **Free-tier context originals:** retain privately for 30 days by default; offer per-upload
  extraction with original discard after successful extraction. **50 MB per user**:
  remove oldest originals first at capacity; retain extracted text and source metadata.
  Show affected originals before upload acceptance. Never delete the device/Drive source.
  **Extracted text stays in the dedicated European Supabase Postgres project until
  user deletion**, separate from original files in private Storage. Free and paid
  versions are planned. **Paid originals have no time-based expiry: retain until user
  deletion within the paid allowance.** At capacity, keep existing originals and
  pause new original storage; offer deletion, more space when available, or text-only
  extraction. Paid original allowance is **5 GB per user**; price is deferred until beta usage is measured.
- **Paid expiry:** 30-day grace after paid access ends, preserving originals and
  download/export access. Pause new originals if over the free allowance; show a
  cleanup deadline. After grace, apply free 30-day original age/50 MB oldest-first
  rules and keep extracted text. Recheck renewals before cleanup.
  Free cleanup never applies silently to paid originals.
- **Chat history:** private cloud sync, retained until user deletion on both tiers;
  allow individual-conversation/all-history deletion. Retention alone does not grant
  future AI-context access. Remove derived chat summaries/indexes on deletion.
- **Saved AI context:** opt-in, default off, with separate journals/extracted-documents/
  previous-chats switches and per-item exclusions. Enforce before retrieval and every
  queued AI call; derived summaries/caches inherit restrictions. Without opt-in, use
  current conversation and task-specific attachments only. Retention, sharing and
  provider approval remain separate permissions.
- **Saved profile memories:** explicit approval for each exact memory and substantive
  AI-proposed update. Private synced list with edit/delete controls; no silent saves
  from chats. Memory use cannot bypass source exclusions or provider/member rules.
  Deletion removes derived context and cannot trigger silent recreation.
- **Providers:** separate user approval for each processor/capability, including
  chat, OCR, speech-to-text and cloud TTS. Automatic fallback requires its own opt-in
  and uses approved capable providers only. Revocation applies to queued calls too.
- **Voice input:** include a speech-to-text adapter; Groq is the initial candidate
  from SchedaPRO. Verify cost, language coverage and data handling before integration;
  testing experience is not a guarantee of free production use.
- **Recorded audio:** discard after successful transcription by default; show an
  editable transcript before send/save. Per-recording keep-original is private and
  uses the same context-original storage quota, tier retention and downgrade rules.
  Original removal never deletes saved transcript text; failed audio has bounded
  temporary processing retention, not indefinite storage.
  Saved gallery memories share the tier byte allowance but do not auto-expire or
  get evicted; downgrade preserves them and pauses new storage if over quota (§21).
- **User-to-user blocking:** prevents contact between the affected pair, not unrelated
  members. A blocking B never prevents B/C communication, sharing or plans. Store
  pairwise block edges, not a global blocked-member status; apply gates per recipient.

**Core features**
- Shared access: optional members join a relationship through unanimously approved,
  recipient-bound invitations; explicit content grants are separate.
- Journal / notes: entries with text, mood, date.
- Important dates: anniversaries, birthdays, milestones — with reminders.
- Photos & media: sentimental photos, standalone or attached to memories.

**Crons / scheduled jobs (central to the app, not an add-on)**
- Check-in messages: default six-hour cadence in waking windows, configurable per
  user/relationship, with a default user-level cap of three proactive nudges per day.
- Important-date reminders: notify ahead of time (e.g. 7d / 1d / day-of).
- Daily digest: morning summary (user timezone).
- Weekly recap: summary of the week's entries/moments.
- Streak tracking: nudge if no entries for a while.

**Delivery channels (per-user, configurable)**
- Push (Capacitor-compatible native integration), SMS, Email, WhatsApp, Telegram, Google Calendar, In-app.

## Remaining owner choices and setup

Use `PLAN.md` §27.B as the complete current owner review list: O1 public brand/persona,
O2 outward AI attribution and O3 translated-message approval are adopted for now;
O1 branding and O5 public pricing are deferred. O4 actual infrastructure budget and
O6 verified processor data terms are activation gates, not local development blockers.
Routine defaults are approved by delegation. Actual support contacts/reviewer names,
credentials, signing, provider prices/coverage and backup purge facts are setup tasks
requiring evidence, not unanswered preference questions. Implementation is authorized; see CURRENT-TASK.md for verified progress.

## Working notes

- Working directory contains `anto-e-anna.webp` (an image — possibly the couple).
- Treat this CLAUDE.md as the living source of truth for project context; update it
  as decisions are made, and move items out of "provisional/open" as they're settled.


## Durable cloud implementation status

Cloud queue/leases, schedules, worker heartbeat, one-minute hosted cron and Settings
controls are implemented. The restricted Python worker reads only a job's ID,
lease and locale, then fixed mock catalog text. No journal access or live providers.
See docs/implementation/CLOUD-SCHEDULING.md for deployment/recovery evidence.
Render activation is pending a restricted database login and actual hosting quote;
never imply the blueprint is a running worker. Keep schedules off until explicit
user activation. SQL fixture tests must remain loopback-only and browser builds
must run sequentially. Root and folder READMEs describe the current boundaries.


## Free interim executor — current default

Use the existing Frankfurt Postgres cron's bounded mock consumer for now. It calls
maintenance/dispatch then the same claim/finish functions, with static catalog text
only. No extra paid host, user-data exposure, network AI or implicit schedule opt-in.
Render runtime/blueprint stay intact for later. Do not add duplicate schedulers or
put slow/network AI work into Postgres. See CLOUD-SCHEDULING.md for switching modes.


## AI consent foundation — current status

Settings stores private future-context opt-in and per-reflection exclusions. Provider
and capability approval/fallback are separate and review-version-bound. All deployed
provider reviews/processing remain disabled, so no real processor consent is offered
prematurely. Do not connect these preferences directly to a network request. Future
calls need execution-time authorization, cost reservation and safety checks. The mock
worker must retain no journal access. See docs/implementation/AI-CONSENT.md.


## AI accounting foundation — current status

Private exact-decimal usage accounting and atomic reservations are implemented.
Global target EUR 20/UTC month, 10% reservation buffer; unknown/started costs keep
holds across rollover. Separate NOLOGIN metering role; browsers only read their own
ledger and edit personal limits/pause. Live_enabled stays false and prices are empty.
No actual transport is enabled by a reservation. Before future calls, recheck source,
consent, lease, region, cost and safety gates at dispatch; record every retry/fallback.
Read docs/implementation/AI-BUDGET.md for retention, reconciliation and activation gaps.


## Frontend visual system

Follow frontend/DESIGN.md. App owns guarded actions; Shell owns the responsive
frame; screens/ and ui.tsx own presentation. Preserve accessible names, explicit
confirmations and cloud/account sequencing. Source-key/interpolation checks and
seven draft catalogs must pass; extend the dynamic-key registry for new families.
Browser suites run sequentially and use fictional data. See
docs/implementation/FRONTEND-OVERHAUL.md. Live AI remains disabled.


## Dormant DeepSeek adapter

backend/app/ai.py is server-only and not wired to routes or workers. Defaults deny
live/network execution; Safety defaults unavailable. Only fixed-input solo drafts
are allowed; no saved content or outward contact. Use the restricted autocommit
meter role, current authorization and committed cost holds. Never auto-load or
upload the local key, activate a processor or place network AI into Postgres cron.
See docs/implementation/DEEPSEEK-ADAPTER.md.
