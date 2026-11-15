# Current task — Phase 0/1 implementation started

Plan: [PHASE-0-1](docs/implementation/PHASE-0-1.md). Branding/pricing deferred.

## Implemented and verified

- M0 runnable React/Vite/TypeScript shell and provisional Capacitor configuration.
- Five-tab responsive UI; seven draft catalogs (87 keys each), language switching,
  system/light/dark theme, local-only fictional-data banner.
- FastAPI API with local-only, host/origin and ephemeral bearer-session guards.
- Durable SQLite **demo adapter**, separate mock worker, persistent jobs and reflections.
- Edit/save a private mock reflection, skip without an artifact, snooze one hour,
  30-minute default expiry, atomic versioned decisions and stale-worker rejection.
- Optional privately tracked relationship labels; no invitations or sharing yet.
- External AI, outbound messages and paid provider calls remain disabled. The hosted
  fictional preview and private Supabase foundation are described below.

## Validation

- `npm run check`: seven-catalog parity/encoding checks, 4 frontend domain/link tests,
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
- M2 private Supabase tables/RLS and email sign-in client are implemented; full
  email/Google auth activation, membership, unanimous invites, pairwise blocks and
  sharing/revocation remain incomplete.
- M3 durable Postgres worker/scheduler integration and outward decision/delivery gates.
- M4 live provider consent/data-term checks, real usage reservations/reconciliation.
- M5 actual Android project/build/device validation and native push.
- M6 hosted beta, recovery checks, reviewed language/safety resources and support setup.

The first local milestone is complete; the overall Phase 0/1 plan is not complete.

## Publishing and cloud milestone

- Existing GitHub repo: chiantera/saymynamesaymyname (main). Commit/push each tested
  milestone going forward, including documentation changes.
- Dedicated Supabase created: chxlkmmkoadgcaomkznd, Frankfurt, healthy.
- Vercel authorization recovered. Project and Git integration are active; tested
  pushes to main deploy automatically to https://saymynamesaymyname.vercel.app.

## Cloud/auth milestone

- Supabase project chxlkmmkoadgcaomkznd (Frankfurt) now has versioned private profile,
  relationship-label, check-in and entry tables, RLS, beta admission and guarded atomic
  check-in RPCs. No anonymous table access; no service key in the frontend.
- Live transactional SQL test passed: owner-only reads, approved reflection, duplicate
  rejection, cross-user denial, and read/write denial for unadmitted or unverified
  accounts. Admission requires a current, verified Auth email. All synthetic auth
  users/data rolled back.
- Client has Supabase email/password sign-in, server-side beta-admission check,
  account-keyed remount on session changes, private record synchronization and sign-out.
- Hosted unauthenticated preview uses browser-local fictional data, never a shared
  server SQLite database. Cloud mode uses only publishable configuration and RLS.
- Registration/recovery redirects are configured and the web client flows exist.
  Live web Google sign-in, verified beta admission and cloud persistence passed.
  Independent-browser/device sync was confirmed by the user. Real email delivery/
  recovery remains a separate acceptance check.
- Cloud worker/automatic scheduling is NOT enabled by this private manual-check-in
  foundation; local scheduling rules still need a Postgres dispatcher/worker port.
- Vercel project prj_AaO8GYUztVykULAArfzI8tCyb3Fq, production alias
  https://saymynamesaymyname.vercel.app; existing account deployment protection retained.
  Git-source deployments verified READY, including commit 37d3962; GitHub CI passed.

## Latest verified deployment / remaining activation work

- Git-triggered deployments of commits 1469c99 and 37d3962 succeeded; GitHub CI also
  succeeded. Production alias returns 200 and a fresh remote browser exercised
  fictional compose/save and the cloud sign-in form without submitting credentials.
- Scheduling additionally prevents cross-scope notification bursts and cancels/revokes
  scheduled jobs/snoozed prompts on pause/disable; 24 backend tests pass locally.
- Beta-access table intentionally has RLS with no read policy and no client grants;
  the security advisor reports this as INFO, not an exposed-table permission.
- User signed into the Supabase dashboard; Site URL and all four exact production/local
  callback/recovery URLs were visibly verified saved on 2026-11-15. Dedicated Google
  project selected; consent screen/basic scopes/provider are configured. The CLI still
  has no management credential. No keys were copied from another project.
- The user completed Google sign-in and explicitly authorized first-tester admission.
  The operator admitted only that verified account. No credentials were handled by
  this agent or added to GitHub/Vercel source; the user transferred the secret directly.
- Concrete activation and validation steps: [Cloud auth setup](docs/implementation/CLOUD-AUTH-SETUP.md).

## Web auth client milestone — 2026-11-15

- Signup/confirmation, recovery/password update, email login, Google OAuth start and
  explicit PKCE callback handling added. Fixed same-origin callbacks; no arbitrary
  `next` navigation or reflected provider errors. Secrets stay out of URLs after exchange.
- Auth checks hide private UI until admission succeeds; late session events cannot
  erase callback errors. Logout/account switches unmount previous account views.
- Cloud requests bind to the account/generation that started them; follow-up operations
  stop when the account changes. Existing cloud locale wins over stale device settings.
- Production assets now use root paths so direct `/auth/*` navigation loads correctly.
- `npm run test:auth` passed with intercepted auth/data endpoints: signup, recovery,
  mismatched passwords, admission denial, two-client private reflection sync, account
  isolation, Google basic scopes/PKCE and rejected callbacks. This is client evidence;
  real Supabase RLS is covered separately by transactional SQL tests. No real emails sent.
- CI now runs the isolated auth browser test in addition to check/build.
- Follow-up auth fixture also exercises first-login profile creation with
  insert-if-absent semantics. Concurrent setup preserves existing cloud preferences.
- Google standard sign-in client remains separate from future Google agent/MCP
  credentials; the setup guide records the AI-agent checkbox choice and its source.

## Live Google and persistence milestone — 2026-11-15

- Google initially rejected the configured secret with `invalid_client`. The user
  corrected the matching client credentials directly in Supabase, then completed a
  fresh Google consent/PKCE return. No secret value was read or published by the agent.
- Before admission, the live app displayed only the admission-pending screen. The
  verified Google identity was checked and explicitly authorized admission applied.
- After reloading, the app loaded the private cloud space and created one profile.
- A fictional check-in was composed/approved in the live browser. After a full page
  reload, its saved reflection remained visible. Independent SQL verification found
  one matching owned reflection and one fulfilled check-in; no duplicate artifact.
- Screenshot: `.local/screenshots/live-private-sync.jpg` (ignored; fictional content).
- Removed obsolete provider-setup wording from all seven sign-in catalogs.
- User confirmed the same saved reflection in a second independent browser/device.
  This is live web sync evidence, not an Android wrapper/device certification.
- Real email recovery is the next acceptance check. Android auth remains M5.
  Cloud auto-scheduling and live AI are still disabled.
