# Current task — Phase 0/1 implementation started

Active slice: crisis-response paths and regional resources. Implemented static help,
quick exit, review-gated topic copy and private explicit-reveal worker safety notices.
Validation and hosted deployment evidence are recorded in the dated checkpoint below.
Live AI/network remain disabled; the free mock executor and Render setup are unchanged.

Plan: [PHASE-0-1](docs/implementation/PHASE-0-1.md). Branding/pricing deferred.

## Implemented and verified

- M0 runnable React/Vite/TypeScript shell and provisional Capacitor configuration.
- Five-tab responsive UI; seven draft catalogs (295 keys each), language switching,
  system/light/dark theme, local-only fictional-data banner.
- FastAPI API with local-only, host/origin and ephemeral bearer-session guards.
- Durable SQLite **demo adapter**, separate mock worker, persistent jobs and reflections.
- Edit/save a private mock reflection, skip without an artifact, snooze one hour,
  30-minute default expiry, atomic versioned decisions and stale-worker rejection.
- Optional privately tracked relationship labels; cloud membership and explicit reflection sharing are separate from the demo.
- External AI, outbound messages and paid provider calls remain disabled. The hosted
  fictional preview and private Supabase foundation are described below.

## Validation

- `npm run check`: seven-catalog/source-key/interpolation checks, 12 frontend tests,
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
- M2 private Supabase tables/RLS and core web Google/email auth are verified for the
  admitted tester. Broader signup/delivery, native auth, membership, unanimous invites,
  pairwise blocks and reflection sharing/revocation were completed in later milestones below.
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
  Independent-browser/device sync and live email recovery/password sign-in were
  confirmed by the user for the same admitted account.
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
- Real email recovery subsequently passed as recorded below. Android auth remains M5.
  Cloud auto-scheduling and live AI are still disabled.

## Recovery callback follow-up — 2026-11-15

- User confirmed receipt of the recovery email. The attempted return failed; live
  auth logs identified `flow_state_expired`. The later fresh-link retry passed after
  the callback build deployed; complete recovery promptly in the initiating profile.
- Callback handling now preserves explicit `sb_flow_id` before URL cleanup and
  passes it to the SDK. An invalid/missing slot cannot borrow another tab's verifier.
- Static localized guidance distinguishes expired/used links and missing browser
  verifier from generic errors; no provider details, tokens or recovery links logged.
- Regression coverage: recovery succeeds from its explicit slot without the legacy
  verifier; server expiry and an explicit nonexistent slot both deny private UI.
  No expiry/verification limits were relaxed.

## Core web auth acceptance complete — 2026-11-15

- After deployment of e02c062, the user confirmed a fresh recovery link allowed an
  app password to be set, email/password sign-in succeeded, and the existing fictional
  cloud reflection remained visible. This is user-confirmed live acceptance; no
  password or recovery link was read by the agent.
- Together with live Google consent/PKCE login, admission denial/authorized admission,
  save/reload and independent-browser/device sync, this completes the immediate core
  web auth/private-reflection sync walkthrough for the admitted tester.
- This does not certify fresh email signup/confirmation for additional accounts,
  wider SMTP delivery, full session/MFA management or native Android callbacks.
  Sharing/membership, cloud worker scheduling and live AI remain later work.

## Membership and invitation milestone — 2026-11-15

- Hosted migration adds current memberships/generations, unanimous recipient-bound
  proposals, digest-only single-use seven-day links, guarded redemption/reissue,
  personal archive/mute, immediate leave and global user-pair block edges.
- Public relationship metadata is readable only by current admitted members; direct
  writes and private table/helper bypasses are denied. Private reflection RLS is
  unchanged. Joining never grants private history or previously shared audiences.
- Membership changes revoke pending invitations; block/unblock affects only the pair.
  Block labels are snapshots so later edits cannot leak to former/new members.
- Cloud Relationships UI supports own aliases, proposal/approval/cancel, deliberate
  link creation/copy/replacement, preview and explicit recipient join/decline, personal
  archive/mute/leave and block controls. The recipient must have separate beta admission.
  Join fragments are cleared from URLs and held only in sessionStorage in that tab;
  same-tab OAuth/password login preserves them. Reopen the original invite if email
  verification opens another tab. No invitation email or other message is auto-sent.
- 17 real PostgreSQL integration tests passed, including concurrent approvals, competing
  joins/redemption and private history checks. Hosted transactional smoke passed and
  rolled back every synthetic account/row/token; the existing private reflection remains.
- Three isolated browser accounts passed creation, joining through login, unanimity,
  A/B/C blocking, personal archive/leave and private history preservation against real
  SQL/RLS. Auth/HTTP transport was simulated; this is not a multi-account live OAuth test.
  Mobile 390px overflow and native confirmation dialogs checked. Local fictional
  screenshots: `.local/screenshots/membership-desktop.png`, `membership-mobile.png`.
- Existing 24 backend tests, 8 frontend tests, TypeScript/build and auth browser suite
  passed. CI now runs database and membership browser tests with a disposable Postgres
  service. No hosted DSN or database password is used by those tests.
- Advisor INFO notices for private deny-by-default tables are intentional. Existing
  Auth warning: leaked-password protection is disabled; follow up in Auth settings
  after checking availability/cost. No new database security warning was introduced.
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Actual messaging, explicit content sharing/grants, historical shared snapshots,
  queued-send cancellation, cloud scheduling and native Android remain later work.
- Published backend milestone 665735b and UI milestone 8e0d10b to main; Vercel's
  production deployment of 8e0d10b is READY. Live authenticated UI successfully created
  one owner-only `Fictional membership test` space, then personally archived it.
  It remains available under Show archived relationships; no invitation was proposed
  or sent. Screenshot: `.local/screenshots/live-membership.jpg` (ignored).


## Explicit sharing milestone — 2026-11-15

- Migration `20261115044505_explicit_reflection_sharing.sql` applied to Frankfurt.
- 23 local real-PostgreSQL tests (17 membership + 6 sharing) passed, including a
  concurrent share/block race. Hosted `supabase/tests/sharing.sql` passed with
  synthetic data rolled back; no real content was shared.
- Production browser fixture passed exact-audience review, B-only access, C
  exclusion, individual revocation and 390px confirmation; Auth/HTTP simulated,
  SQL/RLS real. Existing isolated auth smoke also passed.
- `npm run check` passed: 8 frontend tests, 24 backend tests, TypeScript/build,
  seven draft catalogs with 155 keys. Native language review is still pending.
- Security advisor: two new private tables intentionally have RLS and no client
  policies/grants (deny by default); seven INFO notices now include these tables.
  Existing leaked-password-protection WARN remains unchanged; see
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- Shared text is not wired into AI, search, offline cache or exports. Those future
  paths must use source-aware authorization and revocation before enablement.

- Live Vercel UI verification: the existing account retains its original fictional
  reflection; sharing starts with no selected recipients, empty sent/received
  lists, and disabled confirmation when no eligible relationship exists. No real
  grant was created during this check. Multi-account behavior is covered by the
  isolated real-SQL browser fixture and hosted rolled-back smoke above.


### Sharing refresh race fix

CI exposed a late workspace refresh clearing a recipient selected while that
request was in flight. Refresh now filters selections against current eligibility
in the selected relationship, preserving valid selections and removing unavailable
ones. A deterministic browser regression holds the older response until after
selection. The full browser test also checks block-driven revocation and C's
continued access. Local reruns passed: 23 PostgreSQL tests, three-account browser
flow, 8 frontend tests, 24 backend tests and production TypeScript/build. The
confirmation cancel button now uses the existing localized cancelAction key.


## Durable cloud execution — milestone 1

Added queue/lease/atomic publication contracts and restricted worker role. Local
PostgreSQL tests cover cross-owner denial, duplicate requests, competing claims,
stale leases, cancellation and membership rechecks. Runtime/hosting remain separate.

## Durable cloud execution — milestone 2

Added opt-in schedules, revision-guarded settings, quiet-window/local-day/gap/cap
checks, fair dispatch and stale-work cancellation. Synthetic DST, competing scans,
pause-after-claim, privacy and invalid-timezone tests run in disposable Postgres.

## Durable cloud execution — milestone 3

Added restricted mock worker process, heartbeat, Render Frankfurt blueprint and
secure deployment runbook. Subprocess/restart and seven-locale tests verify real SQL
publication. Live Render activation is not claimed without hosting credentials and
a dedicated restricted database login. No paid compute or external AI was started.


## Durable cloud execution — milestone 4

Added Settings controls for opt-in per-scope scheduling, quiet hours, cap/pause,
worker readiness and queued/cancelled job visibility. Defaults stay off. Cron runs
once per minute, performs expiry/boundary maintenance and dispatches only with a
fresh worker heartbeat. Snoozed work cannot revive after pause/archive/leave.
Manual preview remains separate, with no provider/network AI or external delivery.

34 real PostgreSQL tests passed, including restarted worker processes in seven
locales. The browser test passed schedule save/reload/pause with real SQL, plus all
prior membership/sharing/revocation flows. Auth client smoke passed. Hosted synthetic
smoke passed via admin invocation of narrow worker functions; restricted-role
execution is local evidence, not a claimed live Render connection. All synthetic
hosted rows rolled back. The Render YAML passed the current official JSON schema.

Documentation audited: root status/README/PLAN/SOUL/agent guides and auth/membership/
sharing/scheduling/phase guides; added folder READMEs for client, backend, shared,
scripts, SQL, tests and CI. Historical milestones retain their original evidence.

- Render dashboard GitHub sign-in succeeded and the app repository is available.
  Paid worker provisioning and the restricted DB secret remain pending.

Render dashboard quote verified: $7/month for 0.5 CPU / 512 MB. No service
was created; restricted database-login provisioning and the separate infrastructure
budget gate still apply. Existing security-advisor leaked-password WARN remains;
new private tables have deliberate RLS/no-client-policy INFO notices (11 total).

- Final milestone CI run 43703327766 passed; Vercel served af2d99a. Live Settings
  shows unavailable worker and private/off defaults. Corrected an old local-demo
  footer shown to cloud accounts; production build passed before the follow-up push.
  The last three hosted cron runs succeeded; synthetic smoke user count is zero.


## Free interim execution — 2026-11-15

User chose a free alternative and to retain Render for later. The Supabase organization
is confirmed on Free. Added `20261115103004_free_postgres_mock_worker.sql`: seven
private catalog rows, admin/cron-only bounded consumer, and replacement of the same
named one-minute cron command. Installed in Frankfurt; an explicit first tick
completed with zero unintended work. `supabase/tests/free_worker.sql` passed and
rolled back its synthetic user/check-in. No real member content was shared.

Four new local tests plus the browser ready/queue/tick/draft flow pass. The latter
uses real SQL with simulated Auth/HTTP transport. Render files were not changed.
The existing worker-role and queue contracts remain usable for a later runtime.

- Full rerun: 38 PostgreSQL tests passed; unit/build/catalog checks and the browser
  queue-to-draft flow passed. Live cron command is postgres_mock_tick; its last three
  runs succeeded and readiness is true. Synthetic smoke user count is zero.
- Security advisor: new static catalog is deliberately private with RLS/no client
  policies; 12 INFO notices now. Existing leaked-password protection WARN unchanged.


## AI consent foundation — 2026-11-16

Added private consent preferences, item exclusions, per-capability provider grants,
review-version invalidation and bounded 90-day receipt cleanup. Installed migration
20261116143354_private_ai_consent.sql in Frankfurt. Hosted synthetic smoke passed
and rolled back; all provider catalog reviews/runtime switches remain disabled.
The mock worker has no journal permission and still uses only static catalog text.

Validation: 43 PostgreSQL tests, browser category/exclusion persistence and provider
disablement at desktop/390px, 8 frontend tests, 24 local backend tests, TypeScript/
Vite build and 183-key draft-catalog parity. User preference changes require current
revision; stale writes fail. No provider credentials/calls or paid resources used.
Security advisor has 17 intentional RLS/no-client-policy INFO notices and the prior
leaked-password-protection WARN, unchanged. See AI-CONSENT.md for limits and evidence.

Follow-up review constraint migration 20261116144525 enforces complete non-null
provider review data. Policy URL changes revoke earlier consent even if the version
label is unchanged; restoring the old URL cannot restore approval. Five consent
tests pass, including this regression. The overall database suite now has 43 tests.


## AI metering foundation — 2026-11-17

Added exact-decimal, private task/attempt accounting, immutable reviewed-price
versions, EUR 20 shared month target, conservative reservations, unresolved holds,
separate NOLOGIN metering role and idempotent receipt reconciliation. No configured
prices/providers or live calls. Targeted lifecycle tests passed; further tests and
private user controls/retention are the next integration milestone in this slice.


## AI budget integration — 2026-11-17

Added owner-only budget controls and usage ledger, separate operator-only aggregate
cost view, 50/80/95% status thresholds and bounded retention/expiry maintenance.
Installed both accounting migrations in Frankfurt. Hosted ai_budget.sql passed with
synthetic-only temporary settings and rollback; no live calls or paid resources.
Post-test global live_enabled=false, real price catalog empty, processors disabled.

Validation: 56 real PostgreSQL tests; browser private budget/pause save/reload and
cross-account denial; prior consent/sharing/scheduling flows; 8 frontend and 24 local
backend tests, TypeScript/Vite build and 203-key seven-catalog parity. The mock
consumer remains independent of paid-AI pause. Anonymous monthly cost totals retain
12 months after terminal detail compaction; unresolved cost holds do not expire.

Security advisor: 22 intentional private RLS/no-client-policy INFO notices; existing
leaked-password-protection WARN unchanged. Provider invoicing corrections/imports,
specific billing categories, real price/terms reviews, cost-aware actual transport
and source/safety gates remain explicit prerequisites for paid activation.

Post-smoke verification: global live_enabled=false; zero real price rows/usage rows;
zero enabled processors; synthetic account absent; last three cron runs succeeded.
Auth client smoke also passed. Render and mock-worker source files are unchanged.


## Frontend overhaul integration — 2026-11-17

Completed the interrupted frontend-overhaul against frontend/DESIGN.md. Recovered
39 translation drafts and completed the missing copy in all seven catalogs (295
keys each). Added TypeScript-aware source/conditional key checks and interpolation
parity, extracted/tested the timezone day-band model and removed unused legacy CSS.
Shared primitives, rail/mobile tabs, auth, membership/sharing, scheduling and private
budget/consent views retain their existing authorization contracts. Growth and
Bartender remain explicit previews. Live AI/provider pricing/configuration untouched.

Verification record and remaining release gates:
[FRONTEND-OVERHAUL.md](docs/implementation/FRONTEND-OVERHAUL.md). Local preview
checks passed all 140 locale/theme/width/destination combinations and automated
English WCAG checks; 56 SQL tests and 12 frontend/24 backend tests passed. Auth
fixture accessibility checks passed. Cloud membership, sharing-modal and private
settings audits passed after fixing list/group semantics in provider controls.
All local suites passed; CI/deployment results are checked after push. Screenshots are ignored fictional fixtures.

CI follow-up: Linux axe initially sampled navigation colors during a theme
transition. The shared fixture audit now awaits document font readiness and
actual CSS animation completion before measuring contrast. No accessibility rule
is disabled, no fixed sleep is used and no product behavior is changed.


## Frontend production release — 2026-11-17

Owner authorized merge/deployment. Fast-forwarded frontend-overhaul into main at
75fe4e1; production deployment dpl_9EAPJvwZU5NEXwJwMviK2eEqecvW is READY and the
production alias returns the verified frontend assets. Live AI remains disabled.
The repeated main CI exposed a viewport-transition race in the cloud browser
fixture; wait for mobile-shell rendering before asserting scroll width. Repeat
CI follows that fixture correction. API provider selection/key entry is pending;
no secret has been requested in chat and no provider has been activated.


## Dormant DeepSeek adapter — 2026-11-17

Implemented server-only fixed-input solo composition with narrow SQL job/provider
authorization, independent input/output safety hooks, bounded HTTPS transport and
committed reserve/begin/report accounting. 31 adapter unit tests and six real SQL
adapter scenarios pass; complete database suite 62, backend suite 55. No actual
provider request/key access, new host, public route or worker integration.

Installed dormant gate migration in Frankfurt. Hosted smoke: live=false, zero
price/usage rows, zero enabled processors, no client/mock-worker execute permission.
Security advisor remains 22 intentional private RLS INFO and the existing password
protection WARN. All live defaults stay off; unavailable safety is a hard stop.
See docs/implementation/DEEPSEEK-ADAPTER.md for remaining activation requirements.

Adapter transaction fence: every authorization/meter call checks that an autocommit
connection is IDLE, rejecting explicit transaction blocks opened before or after
gate construction. Real SQL regression coverage includes all three cases.


## Safety checks and dormant AI worker — 2026-11-17

Implemented fixed-input validation, Unicode-normalized risk indicators and mandatory
fresh local safety assessment binding. Python worker has an explicit disabled AI
mode and a metering-role queue/publication bridge. Drafts remain private/pending;
review revocation, unsafe/unavailable judgments or uncertain billing never trigger
automatic paid retry or unreviewed mock fallback. Added processor routing default
mock and isolated mock claim/finish from AI-tagged work. No cron command, paid
host, key loading/upload or processor enablement.

Validation: 44 policy tests, three disabled-CLI tests and 14 real-SQL worker cases;
current suites contain 102 backend/76 database tests. Tests use fictional local
assessments and HTTP mocks, not clinical safety evaluation. Hosted verification
and CI follow the tested migration. See docs/implementation/SAFETY-WORKER.md.

Hosted safety/worker migration installed. Read-only smoke passed; live=false,
zero prices/usage/enabled processors/approved safety reviews/AI-tagged jobs,
mock cron unchanged. Security advisor 23 intentional private RLS INFO (new policy
table) and prior password-protection WARN. Full 76 SQL/102 backend/12 frontend
checks passed; CI/deployment are verified after push. No live provider/key access.


## Crisis paths and regional resources — 2026-11-17

Implemented static help outside auth, current-country selection, 32 sourced
country/region contact mappings, stale-data dial suppression, user-selected support
directories and neutral quick exit. The seven draft catalogs now have 337 keys.
Specific self-harm/violence/stalking advice is stored as draft copy but display is
professionally review-gated; automatic persona-drop and live AI stay disabled.

Worker safety failures now hold the current AI lease and create an owner-only,
minimal notice. Initial UI polling returns only a notice ID; the category is
revealed only on a private user action, with an explicit reminder that rejected
model output is not an assessment of the user. No rejected text, region, diagnosis,
partner contact, analytics event or shared risk profile is recorded.

Validation: 111 backend unit tests, 15 frontend tests, 83 database tests; signed-out
help in the production auth fixture, private reveal/dismiss in the SQL-backed
browser fixture, and all existing sharing/blocking/revocation regressions pass.
The browser matrix additionally exercises 28 help-panel locale/theme/width
combinations, focus return, ephemeral selection, no automatic external requests,
English axe checks and a locally intercepted no-referrer quick exit.

Hosted: `20261117064518_crisis_support_paths.sql` applied; read-only
`supabase/tests/crisis_support.sql` passed. `live_enabled=false`, prices/attempts/
enabled providers/safety reviews/AI jobs/notices all zero. Existing mock cron is
active. Advisor results: 24 intentional private RLS/no-policy INFO findings
(includes the new no-direct-access notice table); the pre-existing leaked-password
protection warning remains. See the [Supabase remediation guide](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
No live API request, secret loading, paid host, automatic user schedule opt-in or
production notice was created. Native-device, clinical and professional/native
copy evaluation remain open. Details: docs/implementation/CRISIS-SUPPORT.md.

Production build passes with the existing Vite chunk-size advisory: main JS about
520 kB (169 kB gzip). The static help/resources stay in the initial client bundle
so opening them does not depend on a later resource-fetch request.
