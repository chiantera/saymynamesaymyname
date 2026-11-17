# Safety policy and dormant AI worker

## Current status

Safety policy checks and the Python worker's AI composition/publication path are
implemented. **Live AI remains off.** The hosted cron still runs the free static
Postgres mock consumer. Render is not activated and no real key is loaded/uploaded.
Existing schedules and queued jobs default to `processor=mock`; neither an API key
nor selecting a worker mode silently reroutes them to AI.

`cloud_worker` defaults to mock mode. Its explicit DeepSeek branch constructs a
`Composer` with a restricted `WorkerGate`, a `PolicySafety` and the fixed HTTP
transport. It requires deployment approvals, a reviewed local assessor/locale
manifest, an explicit reviewed price, database provider consent and database safety
policy approval. Network access is independently off. The shipped CLI has no local
semantic assessor installed, so environment flags alone cannot enable dispatch.
There is no public AI endpoint or new UI switch/AI queue producer in this slice.

## Implemented safety checks

`backend/app/safety.py` provides:

- Exact structural checking of the only supported input: the centralized policy
  core and fixed solo task in one of the seven launch locales. Added messages,
  tools, modified instructions or changed payload types are refused. The trusted
  core's own risk-prohibition words are not misclassified as user crisis content.
- Bounded output schema and Unicode validation. NFKC normalization, removal of
  zero-width format characters and whitespace normalization make simple obfuscation
  less effective. Risk indicators cover self-harm, violence, stalking/coercion,
  instruction injection, role impersonation and unsupported relationship assumptions.
- Mandatory independent **local** assessment for output with no rule hit. Absence
  of keywords never means safe. An allow assessment must bind the exact text hash,
  phase, locale, policy version and expiry within 60 seconds. Missing, stale,
  mismatched, malformed or failing assessments hold the content.
- A second assessment of the exact immutable draft immediately before worker
  publication. A changed policy/review, kill switch or consent cannot be overridden
  by an earlier allow decision.

These are deterministic policy mechanics and conservative indicators, **not a
clinically validated multilingual crisis detector**. Negated/quoted risk terms may
also be held. Tests of fictional assessments demonstrate enforcement, not recall,
precision, translation quality or clinical safety. Production evaluation and a
reviewed semantic assessor remain activation gates. A network judge would need its
own approved processor/capability, prices and metered attempts; the local interface
must not secretly call an unmetered API.

Risk verdicts suppress generated content and hold the job. The worker does not
deliver crisis advice, invent regional resources, contact anyone, send alerts or
grant support staff access. It now creates a private held-output notice through
the guarded lease wrapper; the user can explicitly open the static support panel.
See [CRISIS-SUPPORT](CRISIS-SUPPORT.md). Topic-specific and automatic persona-drop
copy still require professional review before live advice. No
dangerous text or classifier rationale is written into diagnostics or job metadata.

## Queue and publication boundaries

The new `processor` field defaults to mock and is private. Existing producer and
scheduler inserts keep that default. AI jobs must be explicitly tagged through a
future authorized producer; tests tag only disposable fictional jobs.

Mock consumers cannot claim or finish AI-tagged jobs. The old finish implementation
is now an ungranted private helper; the mock wrapper checks the processor. The AI
worker uses the existing NOLOGIN metering role and a narrow `ai_worker_job` RPC:

1. `claim` requires live AI and a reviewed/enabled safety policy, then selects only
   DeepSeek-tagged solo jobs with current consent, beta eligibility, supported locale
   and no unresolved or already-dispatched accounting attempt. Existing 90-second
   leases and three-claim limits remain. It is a consumer, not another scheduler.
2. `authorize` combines existing provider/price/lease checks with current safety
   review/version/locale approval, before and after provider processing.
3. `publish` requires matching job/owner/price/attempt, recorded valid usage within
   reservation bounds, matching current reviews and a digest of the exact text. It
   calls the existing completion logic atomically and records content digest/policy
   receipt metadata. The resulting check-in is **private and pending**, with the
   existing 30-minute decision window; nothing is shared or sent.
4. `hold` marks only the current matching lease failed, without storing risky text.
   It is permitted after a kill switch/revocation so cleanup can still run.

Safety review rows are private/RLS protected and seeded **disabled**. No new login,
table access, role membership, source retrieval or client permission is granted.
The database trusts the restricted worker to perform the assessments; the stored
hash is an integrity/audit binding, not an independently executed SQL classifier or
an unforgeable proof against a compromised trusted worker.

No failed AI check falls back to unreviewed mock/AI content. Timeouts and lost
responses keep their ledger holds. A restarted AI worker cannot automatically
repeat an attempt with reserved/started/unknown/estimated/reconciled accounting;
only safely cancelled unsent reservations can recover through the bounded queue.
The mock consumer cannot steal an expired AI lease. User-requested manual retry,
invoice reconciliation and an AI-capable producer remain separate work.

Content digests and policy revision metadata inherit the existing accounting-detail
retention/compaction policy. They are never placed in product analytics. No prompt,
draft, key, personal name or safety rationale enters the usage ledger.

## Defaults and deployment

The Render blueprint explicitly retains `AI_WORKER_MODE=mock`,
`AI_LIVE_ENABLED=0`, `AI_NETWORK_ENABLED=0`. No paid host is provisioned. DeepSeek
mode additionally needs reviewed terms/safety deployment flags, Frankfurt runtime,
price ID, an installed reviewed local assessor and a restricted login permitted to
assume companion_meter. CLI checks disabled/missing-assessor conditions before any
database connection or credential access. It never auto-loads the local secrets file.
Mock readiness/heartbeat remains mock-only; this slice does not claim a live AI
worker heartbeat or beta readiness. No cron command or schedule opt-in is changed.

## Validation

- Safety-policy tests: seven locale contracts, crisis/violence/stalking/injection
  examples, normalization, malformed input and stale/wrong evidence rejection.
- CLI tests prove disabled/unknown modes and missing assessor fail before DB
  or key access; existing adapter/demo tests remain in the suite.
- Real-SQL worker tests (HTTP and assessments fictional): private pending draft,
  manual approval boundary, no duplicate publication, no-call disabled defaults,
  no-review denial, unsafe holds, revocation/kill after assessment, uncertain-cost
  recovery, role isolation, processor routing and tampered publication rejection.

- Browser/auth/SQL membership regressions run sequentially in CI. No real provider
  requests, balance lookups, secrets, beta-member text or paid safety model used.

See [DeepSeek adapter](DEEPSEEK-ADAPTER.md), [AI consent](AI-CONSENT.md),
[budget accounting](AI-BUDGET.md) and [cloud scheduling](CLOUD-SCHEDULING.md).

## Hosted dormant verification — 2026-11-17

Installed 20261117043406_safety_worker_publication in Frankfurt. The read-only
`safety_worker.sql` smoke passes: the kill switch denies claims, clients/mock
workers lack AI-RPC access, and the shared finish helper is ungranted. Live=false;
zero price rows, usage rows, enabled processors, approved safety reviews or AI-tagged
jobs. The single cron still calls postgres_mock_tick. Private RLS/no-client-policy
notices are deliberate; current hosted configuration gates belong in
[CURRENT-TASK](../../CURRENT-TASK.md).

Local backend, PostgreSQL, frontend/catalog and production-build checks passed.
The targeted adapter/worker rerun also passed after adding pre-reservation network
readiness. No live key, production assessor or paid host was activated.

Technical references checked: https://supabase.com/changelog.md and
https://www.postgresql.org/docs/17/sql-grant.html. This work adds no clinical
resource claims or medical recommendations.
