# Current task — Phase 0/1 implementation started

Plan: [PHASE-0-1](docs/implementation/PHASE-0-1.md). Branding/pricing deferred.

## Implemented and verified

- M0 runnable React/Vite/TypeScript shell and provisional Capacitor configuration.
- Five-tab responsive UI; seven draft catalogs (69 keys each), language switching,
  system/light/dark theme, local-only fictional-data banner.
- FastAPI API with local-only, host/origin and ephemeral bearer-session guards.
- Durable SQLite **demo adapter**, separate mock worker, persistent jobs and reflections.
- Edit/save a private mock reflection, skip without an artifact, snooze one hour,
  30-minute default expiry, atomic versioned decisions and stale-worker rejection.
- Optional privately tracked relationship labels; no invitations or sharing yet.
- No external AI, cloud project, real login, production data or paid calls.

## Validation

- `npm run check`: seven-catalog parity/encoding checks, 2 frontend domain tests,
  24 backend tests, TypeScript and Vite production build.
- `npm run test:browser`: isolated temporary demo database and dedicated ports;
  edit/save, skip, reload persistence, all locales, relationship creation, snooze,
  390px mobile layout, themes and keyboard focus. Zero uncaught page errors.
- npm audit: 0 reported vulnerabilities in installed frontend dependencies.
- Local screenshots: `.local/screenshots/desktop.png`, `mobile.png` (ignored).
- Reuse: adapted SchedaPRO Vite proxy/relative build/chunk configuration and its
  React/Capacitor structure; provider/job interfaces rewritten under our guardrails.

## Run locally

Requires Node 24 and uv (Python 3.12 is managed by uv).

```powershell
npm --prefix frontend ci
uv sync --directory backend --locked --python 3.12
npm run dev
```

Open http://127.0.0.1:5174. The command runs the API (8002), worker and web client.
Local demo state is `.local/demo.sqlite`. Browser tests use separate disposable data.
Do not enter real sensitive information: this preview is a local test adapter.

## Remaining milestones — not represented as done

- Local scheduling implemented: transactional due scan, per-scope cadence, pause/
  timed pause, quiet hours, DST-safe local-day caps, fair scope selection, presentation
  revalidation and deferred snooze. PATCH /api/schedule configures the local adapter.
  Supabase/hosted worker parity and scheduling UI controls remain integration work.
- M2 dedicated Supabase project/migrations/RLS, real email/Google auth, membership,
  unanimous invites, pairwise blocks and sharing/revocation.
- M3 durable Postgres worker/scheduler integration and outward decision/delivery gates.
- M4 live provider consent/data-term checks, real usage reservations/reconciliation.
- M5 actual Android project/build/device validation and native push.
- M6 hosted beta, recovery checks, reviewed language/safety resources and support setup.

The first local milestone is complete; the overall Phase 0/1 plan is not complete.

## Publishing and cloud milestone

- Existing GitHub repo: chiantera/saymynamesaymyname (main). Commit/push each tested
  milestone going forward, including documentation changes.
- Dedicated Supabase created: chxlkmmkoadgcaomkznd, Frankfurt, healthy.
- Vercel project creation blocked by team grant (403); authorization recovery link
  issued. No remote deployment or Git auto-deploy has been confirmed yet.

## Cloud/auth milestone

- Supabase project chxlkmmkoadgcaomkznd (Frankfurt) now has versioned private profile,
  relationship-label, check-in and entry tables, RLS, beta admission and guarded atomic
  check-in RPCs. No anonymous table access; no service key in the frontend.
- Live transactional SQL test passed: owner-only reads, approved reflection, duplicate
  rejection and cross-user denial; all synthetic auth users/data rolled back.
- Client has Supabase email/password sign-in, server-side beta-admission check,
  account-keyed remount on session changes, private record synchronization and sign-out.
- Hosted unauthenticated preview uses browser-local fictional data, never a shared
  server SQLite database. Cloud mode uses only publishable configuration and RLS.
- Registration/recovery redirects, Google OAuth credentials and actual verified tester
  admission are not configured. Those flows are not represented as working yet.
- Cloud worker/automatic scheduling is NOT enabled by this private manual-check-in
  foundation; local scheduling rules still need a Postgres dispatcher/worker port.
- Vercel project prj_AaO8GYUztVykULAArfzI8tCyb3Fq, production alias
  https://saymynamesaymyname.vercel.app; existing account deployment protection retained.
  First deployment READY. Verify a subsequent Git push triggers deployment before
  claiming automatic deployment works.

## Latest verified deployment / remaining activation work

- Git-triggered deployment of commit 1469c99 succeeded automatically; GitHub CI also
  succeeded. Production alias returns 200 and a fresh remote browser exercised
  fictional compose/save and the cloud sign-in form without submitting credentials.
- Scheduling additionally prevents cross-scope notification bursts and cancels/revokes
  scheduled jobs/snoozed prompts on pause/disable; 24 backend tests pass locally.
- Beta-access table intentionally has RLS with no read policy and no client grants;
  the security advisor reports this as INFO, not an exposed-table permission.
- Email signup/recovery callbacks and Google credentials require Auth dashboard setup;
  no management credential is available through the local Supabase CLI. No keys were
  requested or copied from another project. Real account sign-in is not E2E-certified.
- No real beta account was created by this agent. Operator admission must follow a
  verified sign-up; the deployed prototype explicitly explains these current limits.
