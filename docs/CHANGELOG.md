# Implementation milestones

Dated evidence is separate from [current status](../CURRENT-TASK.md). Commands and
CI report actual test totals. Local fixtures, hosted schema checks, production
asset checks and real user/device acceptance prove different things.

## 2026-11-18

- Accepting a relationship invitation now admits the verified recipient to the beta
  ([0006](decisions/0006-invitation-grants-beta-access.md)); unadmitted invitees see
  the invitation review instead of a dead end. Approved invitations now say the link
  must be created and sent manually, and sharing explains when a relationship has no
  other members yet. Migration applied to the hosted project; the waiting invitee
  was admitted at the owner's request.

- Decided the operator's machine runs the restricted AI worker during testing
  ([0005](decisions/0005-local-ai-worker-for-testing.md)). Added a launcher that loads
  only an ignored, allowlisted env file and a connection check that claims nothing.
  No login was created, no gate opened, no provider called. [Runbook](implementation/LOCAL-WORKER.md).

- Compared Frankfurt worker hosts and EU storage for uploads, including costs,
  idle shutdown and backup limits. See the [research](implementation/FREE-CLOUD-RESEARCH.md).

## 2026-11-17

- Switched the database command to discover tests automatically while explicitly
  excluding separately executed SQL-backed browser suites. Fixed a consent fixture
  that assumed a provider had only one capability and depended on test order.

- Added local active-edit checkpoints and revision-fenced private cloud copies,
  recovery after reload, explicit retry/restore and device-only removal. Browser
  storage and offline-start limitations remain. [Recovery](implementation/EDIT-RECOVERY.md).

- Added owner-only cloud recovery for displaced edits with immutable retry IDs,
  deletion tombstones and explicit save/retry status. The checkpoint milestone
  above extends this earlier protection. [Recovery](implementation/EDIT-RECOVERY.md).

- Tightened cloud request input/result typing and mapped only the exact server
  stale-decision error to the existing conflict message. Raw diagnostics remain
  hidden. Initial displaced-edit recovery was temporary; the later cloud recovery
  milestone above supersedes it after server acknowledgement.

- Reduced cloud reads with idle/active cadence, bounded failure backoff, hidden-tab
  pause, one fresh read on return and one identity check per refresh batch. The
  SQL-backed browser regression caught and verified immediate Home refresh after
  queue changes. [Polling](implementation/POLLING.md).
- Added enforced CSP, HSTS, no-referrer, nosniff, no-framing and restricted browser
  permissions. Production-build auth and SQL-backed membership/sharing tests run
  under the policy; inline script, forbidden fetch and embedding probes are blocked.
  Hosted root/callback/assets were checked separately. [Headers](implementation/SECURITY-HEADERS.md).
- Recovered unfinished Fable review artifacts locally. Its completed unit runs
  passed; no final review verdicts/handoff were produced. Independently verified
  that `httpx2` is used transitively by Starlette TestClient and retained it. An
  interrupted credential scan is not a completed audit.
- Consolidated current status, agent guidance, topic specifications and folder
  READMEs; kept original documents in a private ignored archive and added local
  Markdown-link validation. Accepted product/safety decisions remain in the plan.
- Added sourced regional support resources, explicit temporary country selection,
  private held-output notices and quick exit. Topic advice/automatic crisis copy
  remain review-gated. [Crisis support](implementation/CRISIS-SUPPORT.md).
- Implemented dormant server DeepSeek composition, independent safety assessment
  enforcement and worker publication/lease/usage fences. Fixed the accounting
  transaction boundary so possibly dispatched costs cannot roll back or replay.
  No real provider call, reviewed assessor or paid runtime was activated.
- Finished the DESIGN.md frontend overhaul, recovered missing draft translations
  and verified responsive/theme/accessibility/auth/sharing states before production.
- Added private budget controls, exact-decimal reservations and usage reconciliation
  mechanics. Real model prices, invoice integration and live activation stay gated.

## 2026-11-16

- Added private saved-context preferences, reflection exclusions and review-version-
  bound processor/capability/fallback consent. Provider controls remain disabled
  until actual processing reviews. [Consent](implementation/AI-CONSENT.md).

## 2026-11-15

- Verified core live web Google/email auth and fresh-flow password recovery for an
  authorized beta account, with reflection persistence and a second browser/device.
  This was bounded acceptance, not a claim of broad signup/native readiness.
- Implemented unanimous recipient-bound invitations, generation-fenced membership,
  personal archive/mute/leave and pairwise blocks; then named reflection grants,
  snapshots and revocation. Local real-SQL/browser and rolled-back hosted fixtures
  checked authorization without sending invitations or exposing real beta data.
- Added durable cloud queue/leases, scheduling controls, maintenance/recovery and
  worker status. Chose the existing Frankfurt Postgres static mock consumer as the
  free interim executor; retained the unactivated Render blueprint.

## 2026-11-14

- Authorized Phase 0/1 under delegated defaults, choosing React/Vite/TypeScript +
  Capacitor, FastAPI reuse, dedicated European Supabase and phased implementation.
- Built the runnable fictional local loop, SQLite demo/worker, locale shell and
  initial scheduler/reliability proofs; connected Vercel Git deployment and the
  private cloud schema foundation. Local success did not imply native/beta readiness.

Raw operational receipts, private account narratives, deployment/project IDs and
local screenshots are not published here. Historical references can be inspected
in Git history; use current guides for current behavior.
