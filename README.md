# saymynamesaymyname

> A personal growth & relationship companion — built around a timely, AI-drafted check-in loop.
> **Status: implementation started.** A runnable local fictional-data check-in demo
> is available locally and on [Vercel](https://saymynamesaymyname.vercel.app).
> Core web Google/email sign-in, recovery and private reflection sync are verified
> for the admitted tester. Cloud relationship membership, unanimous invite links and
> pairwise block controls are implemented and tested. Explicit saved-reflection sharing and revocation are tested. Broader signup,
> live AI and native Android remain incomplete. A free, database-hosted mock worker
> now runs the durable queue; Render is retained for later.
> Execution plan: [Phase 0/1](docs/implementation/PHASE-0-1.md).
> Verified progress and remaining gates: [CURRENT-TASK.md](CURRENT-TASK.md).

---

## Try the local preview

```powershell
npm --prefix frontend ci
uv sync --directory backend --locked --python 3.12
npm run dev
```

With Node 24 and uv installed, open [the local preview](http://127.0.0.1:5174).
The command starts React, FastAPI and a separate mock worker. Review/edit/save,
skip or snooze a private check-in; try all seven languages and optional private
relationship labels. Local SQLite is a demo adapter, not the production database.
No provider keys or paid APIs are used. Do not enter real sensitive data.

Validation: `npm run check`, `npm run test:browser` and `npm run test:auth`. Browser tests use isolated
fictional state. Details and limitations are in [CURRENT-TASK.md](CURRENT-TASK.md).
The auth client test uses a production build with intercepted endpoints: it never
creates a real account or sends an email. Separate live Google login, owner-account
email recovery/sign-in, save/reload and independent-browser/device sync passed;
details and evidence limits are recorded in the setup guide.

Cloud accounts can create a relationship, choose a shared alias, propose a named
recipient and collect unanimous approval before creating a seven-day invite link.
The recipient signs in with the matching verified email and explicitly joins; beta
admission is separate. Links are shared manually; no invitation emails are sent.
Members can archive/mute personally, leave, or block another person without removing
them or restricting unrelated members. Private reflections remain private.
See [membership implementation and tests](docs/implementation/MEMBERSHIP.md).

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
  per-channel defaults *and* a per-check-in override. The initial preset is **skip
  after 30 minutes**; users can change both action and window at either level.
- **Private by default.** Personal data syncs privately across your devices by default;
  sharing with relationship members is opt-in and AI-provider access is separate; the AI sees only
  what it needs. Context you upload is treated as **untrusted data, never instructions**.
- **Safety is the floor, not a feature.** The app will **never** enable monitoring,
  tracking, pressuring, or controlling another person. Delivery respects personal
  mute/leave/archive boundaries and **user-to-user blocks**, enforced in code.
  If A blocks B, B and C can still communicate, share and make plans together.
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

- **Schedule / Trigger** — start at every 6 waking hours, with editable frequency
  and local quiet hours of 22:00–08:00. A tick + due-scan respects per-user timezones
  and the approval window; deferred nudges do not flood the user in the morning.
- **Compose** — the AI drafts the check-in from privacy-filtered context.
- **Deliver** — through the member's chosen channel, gated by a **recipient-reachability**
  check (boundaries are honored before anything sends).
- **Respond / Reflect** — one winning decision with separate fulfilled, skipped,
  cancelled, failed and uncertain outcomes. Internal idempotency prevents double claims;
  unknown external delivery is reconciled rather than blindly retried.

---

## Delivery channels (per-user, configurable, phased)

Push · SMS · Email · WhatsApp · Telegram · Google Calendar · In-app.
Notification previews are discreet by default; richer details require opt-in.

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
- **Provider consent:** separate approval for each processor and capability; automatic
  fallback uses approved providers only. Voice input has its own speech-to-text
  adapter, initially evaluating Groq from SchedaPRO.
- **Centralized system-prompt core** prepended to *every* call — it enforces the inclusive
  invariants (mirror the user's own names, pronouns, and labels; never guess) and the
  safety guardrails.
- **Context-builder** assembles a privacy-filtered view per call; uploaded docs/images
  (OCR'd) become citable context, tagged as data.
- **Saved-context controls:** opt in separately to journals, extracted documents and
  previous chats, with per-item exclusions. Without opt-in, use only the current
  conversation and explicitly attached material.
- **Saved memories:** the bartender asks before saving each profile fact. Users can
  review, edit or delete approved memories in a private list.
- **Graceful degradation:** if the API is down, the bartender simply says so
  ("the bar's closed…") rather than failing silently.

---

## Agreed technical direction

| Layer | Direction |
|---|---|
| Client | **React + Vite + TypeScript + Capacitor** (decided): shared web UI; **web + Android first**, iOS later; reuse SchedaPRO. |
| Backend / DB | **FastAPI** reused from SchedaPRO + a **dedicated Supabase project in Europe** (Postgres, Auth, Storage). Frankfurt selected; Vercel request handlers + Frankfurt processing worker (PLT Render pattern), durable Supabase jobs. |
| Sign-in | Email/password and Google on web and Android, with email verification and password recovery. |
| Web hosting | **Vercel**, drawing on PLT's frontend/FastAPI deployment pattern. |
| Scheduling | Supabase `pg_cron` due-scan + durable Postgres jobs; Frankfurt worker executes leased tasks. |
| AI | DeepSeek (primary) + Anthropic (fallback); Mistral / Claude vision for OCR. |
| Localization | **Italian, Spanish, Korean, Mandarin, Cantonese, English and German first.** Static UI via i18n; dynamic AI content generated per-recipient (no machine translation); RTL-aware; localized crisis resources. |

This app is the third in a family — **PLT (legal) → SchedaPRO (fitness) → this
(relationships)** — that recycles infrastructure and swaps the domain. Reuse candidates
and the domain mapping live in `PLAN.md` §13. Remaining pre-build decisions and
first-slice acceptance criteria are in §14. §27 closes routine decision-making and
lists owner-sensitive choices. The PLT hybrid is decided: Vercel, a Frankfurt
processing worker, and durable job state in Supabase.

---

## Repo contents

| File | Purpose |
|---|---|
| `PLAN.md` | The full living plan — idea, check-in loop, data model, roadmap, crons, AI usage, localization, **guardrails (§12)**, and reuse notes. **Start here.** |
| `SOUL.md` | Why the product exists — mission, thesis, who it's for, what it is *not*, and the smell tests every feature must pass. |
| `CLAUDE.md` | Working guidance & living source of truth for project context. |
| `CURRENT-TASK.md` | Verified milestone progress, run/test commands and remaining limitations. |
| `docs/implementation/PHASE-0-1.md` | Ordered implementation milestones and completion gates. |
| `frontend/` · `backend/` · `shared/` | Local React client, FastAPI/demo worker and seven prototype catalogs. |
| `LICENSE` | MIT. |

> Not committed here: the sibling codebase (`schedapro/`, its own repo) and a personal
> photo, both intentionally excluded — see `.gitignore`.

---

## Navigation and localization

The planned navigation is **Home, Relationships, Growth, Bartender and Settings**.
Relationship context stays separate by default; private multi-relationship advice
requires explicit selection. Seven launch languages include German. Translation
catalogs live in Git, with native-speaker review and professional safety-copy review;
full right-to-left interface locales follow later.

---

## Account security and imports

The first version uses encrypted transport and managed at-rest encryption with
server-side authorization; it does not claim end-to-end encryption. Approved AI
processing receives only authorized content. Authenticator-app 2FA is optional for
users and required for administrative/support accounts. Google Drive imports are
one-time copies of user-selected files, separately authorized from Google sign-in.

---

## Analytics

Three separate planned areas: **private personal insights**, **content-free product
analytics**, and **operations/cost monitoring**. Other members cannot view a user's
private activity dashboard; developer product metrics do not grant access to it.
Measure helpfulness and notification burden alongside reliability. Product analytics
is opt-in/off by default and stored separately in European Supabase: events retained
90 days, non-identifying totals 12 months, with small-cohort suppression. No session
replay, screen recording or keystroke capture. Personal insights show factual progress
and self-reported moods; AI interpretation is requested separately. No tracking is
implemented yet.

---

## Everyday controls

Read cached content and draft notes offline; sharing and sending require connectivity.
Start with a configurable cap of three proactive nudges per user per day. Optional
PIN/biometric app lock uses a five-minute idle timeout. Users can pause reminders or
snooze individual check-ins; snoozing suspends automatic sending. Use one primary
reminder channel with explicitly enabled fallbacks. Group shares preview their
recipients; personal streaks stay private and optional. Settings includes account
deletion with final confirmation and an export option beforehand. Exports are private
ZIPs with readable text, JSON and accessible retained originals. Conflicting offline
edits preserve both versions; owners can revoke live sharing access. Automated outward
sends and sensitive AI actions pass independent server-side gates.

---

## Remaining owner review

The latest ten defaults are approved, including session controls, confirmed timezone
changes, pending-send cancellation, truthful delivery status, date reminders, app-owned
Calendar publishing, growth goals, accessibility, themes and quick-exit.

Routine engineering defaults are delegated. The finite review list is **public brand,
outward AI attribution, translated-message approval, total infrastructure budget,
future public pricing/AI allowances, and actual processor data terms**. Setup facts
such as the support address and reviewer assignments still need to be supplied and
verified. See `PLAN.md` §27; there is no further numbered approval queue.

---

## Planned inputs and testing

Context uploads initially support PDF, DOCX, TXT, JPEG, PNG and WebP, up to 20 MB
per file and ten per batch. Voice notes are capped at five minutes. Users review
extracted text before accepting it into saved context. Shared-plan participants
respond for themselves; declining push permission leaves the in-app inbox available.
Local/preview testing uses fictional data and mocked providers by default, with
explicitly enabled live tests and real web/Android validation before beta.

---

## Storage and versions

Private originals live in Supabase Storage; extracted text lives in Postgres in our
European project and stays until the user deletes it. Bartender chat history also
syncs privately and stays until user deletion on both free and paid tiers. Free context-original storage
is **50 MB per user / 30 days**, with oldest originals removed first at capacity and
extracted text preserved. Users can also extract text and discard an original.
The initial paid tier provides **5 GB per user for context originals**, retaining them
until user deletion within the paid allowance, with no automatic 30-day expiry.
Deliberately saved gallery memories share the tier's byte allowance, but never
expire or get automatically evicted, including after downgrade; new storage pauses
when the remaining allowance is insufficient.
When paid storage fills, existing originals stay accessible and new original storage
pauses; users can free space or extract text without retaining a new original.
After paid access expires, a **30-day grace period** preserves originals and export
access. Then the free storage policy applies; extracted text remains.
Voice recordings are discarded after successful transcription by default; users may
keep individual originals under their storage tier. Saved transcripts remain separate.
Public pricing follows measured beta usage; the invite-only beta has no real billing.
Selected testers may receive time-limited paid-feature grants. Diagnostic logs contain
redacted technical metadata for 14 days; users choose what to share with support.
Support-report content is deleted 30 days after closure, independently of user originals.
These are planned features, not live services.

---

## Roadmap (phased)

Initial access will be an **invite-only beta with worldwide intended coverage**;
admission is separate from relationship invitations. Locale, country-specific help
and provider availability are handled independently. The AI development budget is
EUR 20/month, tracked centrally; hosting/storage costs are separate. See `PLAN.md`
§15–§16 for worldwide rollout and cost accounting.

- **Phase 0** — solo growth + relationships scaffolding (accounts, invite, data model).
- **Phase 1** — the minimal AI check-in loop end-to-end.
- **Phase 2** — memories, the advisor, bartender tools.
- **Phase 3** — additional delivery channels.
- **Phase 4** — smarter scheduling & personalization.

---

## License

MIT © 2026 — see [`LICENSE`](./LICENSE).

### Explicit reflection sharing

Saved reflections stay private. Cloud users can review a fixed copy and its exact
recipients before sharing, read received copies and revoke access individually.
Pairwise blocks cancel only that pair’s grants. This does not enable AI use or
external delivery. See [sharing implementation](docs/implementation/SHARING.md) for
the access model, tests and limits.


## Developer map

| Folder | Purpose |
|---|---|
| [frontend](frontend/README.md) | React web client, Capacitor configuration and account-scoped cloud access |
| [backend](backend/README.md) | Local FastAPI adapter and separate cloud worker runtime |
| [supabase](supabase/README.md) | Versioned SQL, guarded RPCs and transactional hosted smoke tests |
| [shared](shared/README.md) | Seven draft locale catalogs, shared by browser and deterministic worker |
| [scripts](scripts/README.md) | Local process launcher and catalog checks |
| [docs](docs/README.md) | Implementation evidence, deployment runbooks and remaining activation gates |

## Durable cloud execution

The production database is the queue authority. A user submits a request with an
idempotency key; the queue exposes only that user's job status. A restricted worker
claims a 90-second fenced lease. Completion rechecks beta admission and current
membership, atomically creates one private check-in and completes the job. Lost
leases may be recovered, with at most three claims; stale workers cannot publish.
No private journal/context is sent to the deterministic mock composer.

This is separate from the instant private preview path. Adding queue tables does
not mean that a Render worker is deployed or that real AI calls are enabled.
See [cloud scheduling runbook](docs/implementation/CLOUD-SCHEDULING.md).


## Running and operating the cloud worker

The queue, schedule RPCs, heartbeat and one-minute Supabase cron are installed in
Frankfurt. **The free Postgres mock worker is active.** Settings reports readiness and allows
queued mock generation; the Render service stays unprovisioned. Schedules are off until explicitly
enabled by their owner; private instant preview stays available independently.

The validated [Render blueprint](render.yaml) uses Frankfurt, checks-passed deploys
and a restricted database-login secret. Never put that secret in Vercel frontend
variables or Git. See the [runbook](docs/implementation/CLOUD-SCHEDULING.md) for role
provisioning, TLS, heartbeat, cancellation, recovery and activation checks.

| Check | What it proves |
|---|---|
| `npm run check` | Catalogs, domain/API tests, TypeScript and production build |
| `npm run test:database` | 43 real PostgreSQL authorization, consent, concurrency and worker tests |
| `npm run test:auth` | Isolated client auth/recovery/account boundaries; Auth endpoints simulated |
| `npm run test:membership` | Real browser plus SQL for membership, sharing, revocation and schedule persistence |
| `supabase/tests/cloud_worker.sql` | Hosted synthetic queue workflow with rollback; admin invocation, not a Render process |

Run browser suites sequentially because each builds frontend/dist. SQL tests refuse
hosted DSNs. Static catalogs have 183 draft keys per locale; native/safety review
remains open. A green CI run and a ready Vercel alias are verified separately.

## What remains after these four milestones

Later external-worker credentials/Render deployment when needed, provider approvals and cost ledger,
live AI safety evaluation, Android device/auth/push checks, broader session/MFA and
account operations, reviewed resources/translations, backups and restoration drills.
Documents/media/voice/Drive, rich goals and external channels remain phased features.
Branding and pricing are still deferred. No real payments or provider calls are enabled.


## Free hosting for the current mock phase

The one-minute Supabase cron runs a private, bounded SQL consumer in our existing
Frankfurt database: no additional account, subscription or database password in a
worker host. It uses the same leases and completion checks as the retained Python
worker. Static drafts become reviewable; saving a reflection still requires approval.
Schedules remain opt-in. This is mock-only and must not make network AI calls.

The organization is on Supabase Free. Work counts against its shared database
capacity and normal availability limits; free projects can pause. There is no
additional worker-hosting subscription. The [runbook](docs/implementation/CLOUD-SCHEDULING.md)
records tests, limitations and the switch back to Render. `render.yaml` remains
unchanged for that later step.


## Private AI preferences

Settings now supports off-by-default saved-reflection context preferences and
persistent individual exclusions. Sharing remains a separate permission. Provider
approval is per capability, with separate fallback approval and review versions;
provider controls are unavailable until reviewed. **All live AI remains disabled.**
See [AI consent](docs/implementation/AI-CONSENT.md) for behavior and remaining gates.

The free interim hosting choice is recorded in
[decision 0001](docs/decisions/0001-free-interim-executor.md): use the existing
Frankfurt database for bounded static mocks and retain Render for later.
