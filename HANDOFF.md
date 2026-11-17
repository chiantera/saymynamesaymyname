# Handoff

Written 2026-11-18 against `main` as last pushed on 2026-11-17. This is a point-in-time
orientation for the next engineer. It does not replace the authoritative documents
below; where they disagree, they win, and this file should be deleted or rewritten.

## Read in this order

1. [AGENTS.md](AGENTS.md): the single working guide, including the product invariants
   that must never be weakened. `CLAUDE.md` only points there.
2. [CURRENT-TASK.md](CURRENT-TASK.md): present status per milestone and what is
   deliberately still off.
3. [docs/TESTING.md](docs/TESTING.md): every command, what it needs and what it does
   not prove.
4. [Phase 0/1 checklist](docs/implementation/PHASE-0-1.md): the bounded execution plan.
5. [SOUL.md](SOUL.md) and the [plan index](PLAN.md) when a change touches product
   behaviour; the [safety specification](docs/plan/SAFETY.md) wins over everything else.
6. [frontend/DESIGN.md](frontend/DESIGN.md) before any UI change.

[docs/README.md](docs/README.md) maps where each kind of information lives. Update the
right source; do not append status sections to the root files (`npm run test:docs`
enforces length limits on them).

## The app in three sentences

A private, mobile-first companion for personal growth and for any number of
relationships a person chooses to track (0..N relationships, each with 1..N members,
no assumptions about gender, orientation or shape). Its engine is the check-in loop:
a timely prompt arrives with a draft, and the person saves, edits, snoozes or skips;
every AI output is a draft and the last word is theirs. Solo use is complete on its own.

## Where it stands

- **Works on the web:** sign-in (email/password and Google), recovery, private
  reflection sync across devices, relationships with unanimously approved invitations,
  pairwise blocks, personal archive/mute/leave, explicit read-only sharing with
  revocation, opt-in schedules, private recovery of edits displaced by a changed
  check-in, static crisis help and quick exit, private AI consent and budget settings.
- **Running, but mock only:** the scheduler is the existing one-minute Supabase cron,
  and drafts come from a bounded static catalog consumer inside Postgres. No AI
  provider is called anywhere.
- **Built but dormant:** the server-side DeepSeek adapter, the Python AI worker branch,
  the safety policy and publication fences, the metering role and reservations. Live
  flags are false, prices are empty, provider reviews are disabled, and there is no
  public AI route. The Render worker blueprint is kept for later and is not deployed.
- **Not started or unverified:** native Android project, build, auth callbacks and
  push; outward delivery channels (SMS, email, WhatsApp, Telegram, Calendar); uploads,
  OCR, voice; the Growth and Bartender areas (labelled previews only); account
  deletion and export; professional and native-speaker review of translations and
  safety copy.

The full milestone table (M0 to M6) and the gates before live AI are in
[CURRENT-TASK.md](CURRENT-TASK.md).

## Verified for this handoff

`npm run check` passed on 2026-11-18: documentation links and contracts, catalog
parity across the seven locales, frontend unit tests, backend unit tests, TypeScript
and the production build. The browser suites (`test:browser`, `test:auth`,
`test:membership`) and the PostgreSQL suite (`test:database`) were **not** run for this
handoff; CI runs them on every push. Counts come from the commands, so none are copied
here.

## In-flight work in the working tree

At the time of writing, uncommitted edits exist that are not part of this handoff:
a new [free cloud research](docs/implementation/FREE-CLOUD-RESEARCH.md) note plus
small cross-references in `CURRENT-TASK.md`, `README.md`, `docs/CHANGELOG.md`, the
decision record and several implementation guides. They record research only; no host
was chosen or provisioned. Whoever owns them should commit or discard them; do not
fold them into unrelated work.

## Recommended next work

Ordered by value for effort. Each item names where to look and what done means.

1. **Leaked-password protection (operator task).** The hosted Supabase security
   advisor has long reported it off. Check availability on the current plan, enable it
   if possible, and record the outcome in the changelog. No code change.

2. **CI hardening** in [check.yml](.github/workflows/check.yml). Today it is one serial
   job with actions pinned by tag (`checkout@v4`, `setup-node@v4`, `setup-uv@v6`), no
   npm or uv cache, no dependency audit, no Dependabot config, no concurrency
   cancellation and no artifacts on failure. Done when: actions are pinned to commit
   SHAs, npm and uv caches are on, `npm audit` and a Python audit run, a Dependabot
   config covers npm, uv/pip and GitHub Actions, superseded runs cancel, and browser
   screenshots and server logs from `.local/` upload when a job fails. Unit, database
   and browser stages can run as separate jobs; the three browser suites must stay
   sequential because they share `frontend/dist`.

3. **Linting and formatting.** There is no ESLint, Prettier, Biome or Ruff
   configuration. Several files still use dense one-line branches (for example
   [cloud.ts](frontend/src/cloud.ts)), and many SQL migrations and Python tests have
   very long lines. Add a TypeScript linter with React hooks rules and a formatter for
   the client, Ruff for Python, wire both into `npm run check` and CI, and land the
   formatting diff on its own commit. Never reformat migrations that are already
   applied to the hosted database; add new ones in readable style.

4. **Error boundary and URL routing, before Android work.** The active destination is
   component state in [App.tsx](frontend/src/App.tsx), so a refresh or the Android back
   button loses the user's place, and there is no React error boundary, so one render
   error blanks the app. Add a top-level boundary with a calm recovery screen that still
   offers crisis help, and lightweight path or hash routing for the five destinations
   that leaves `/join` and `/auth/*` handling intact. The browser tests click navigation
   buttons by accessible name, so keep those names. Handle the Capacitor back button
   when the native project lands.

5. **Bundle size.** The production build emits one main script of about 540 kB
   (about 175 kB gzipped) and Vite prints a chunk-size warning. Lazy-load the six
   inactive locale catalogs and consider splitting cloud-only screens. Keep the crisis
   help and its resources in the initial bundle on purpose, so they work during an API
   outage.

6. **Split [Relationships.tsx](frontend/src/Relationships.tsx)** (about 790 lines) into
   the invitation review, the relationship card, invitations and membership controls.
   The membership browser test pins accessible names and the `.member-row` class.

7. **Remove dead code in [cloud.ts](frontend/src/cloud.ts).** The `POST /relationships`
   branch creates a relationship with the English alias `'Member'`. It is unreachable
   today because cloud mode renders the full Relationships screen, which collects an
   alias, but it would ship an untranslated, invented name if anything called it.

8. **Repository visibility (owner decision).** The repository is public. The docs have
   been scrubbed of operational identifiers and account stories, and the guide says to
   keep it that way, but the git history still contains the earlier versions. Decide
   whether the repository should be private before real users arrive; rewriting
   history is a separate, deliberate step.

9. **Then the remaining milestones:** M5 Android (native project, build, auth
   callbacks, permissions, real-device push) and the M4 activation gates (processor
   terms, actual prices and region, an evaluated local safety assessor, reviewed locale
   and crisis copy, an approved runtime). Live AI stays off until all of those have
   evidence; see [CURRENT-TASK.md](CURRENT-TASK.md).

## Corrections to the earlier review

A review in this session proposed several changes that have since been made on `main`,
or that were wrong:

- `httpx2` was flagged as an unused dev dependency. It is required: the installed
  Starlette `TestClient` uses it. [AGENTS.md](AGENTS.md) now says to keep it.
- Cloud polling, browser security headers, the stale-decision conflict message in
  cloud mode, the documentation consolidation and database test discovery have all
  been done. See [polling](docs/implementation/POLLING.md),
  [security headers](docs/implementation/SECURITY-HEADERS.md) and
  [edit recovery](docs/implementation/EDIT-RECOVERY.md).

## Things that are easy to break

The full list is in [AGENTS.md](AGENTS.md). The ones most often at risk during
refactors:

- Account-generation checks before and after every cloud operation, and sequencing
  that discards older responses. These live in [cloud.ts](frontend/src/cloud.ts) and
  the screen components.
- Blocks are pairwise. A blocking B never stops B and C from talking, sharing or
  making plans.
- Skip is not completion, and silence never authorizes sending.
- The content security policy is enforced in browser tests. Never bypass it in a
  fixture to make a test pass.
- SQL fixtures refuse hosted databases. Do not relax that guard.
- Do not add a second scheduler, a paid host, or network AI inside Postgres.
