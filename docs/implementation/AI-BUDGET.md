# AI budget controls and usage ledger

## Accounting foundation

Live AI is disabled in a private global kill switch. The default shared application
target is EUR 20 per UTC calendar month, separate from hosting/storage. No live
price rows, provider credentials, provider calls or external service are added.
A separate NOLOGIN companion_meter role has narrow metering functions; browser
accounts and the mock worker have no access. This does not activate that role as
a login or widen the mock worker's journal permissions.

Every prospective charge is a separate attempt, keyed by logical task and attempt
number. A retry/fallback is a new attempt, not a replay of the old reservation.
All writes take the existing transaction advisory lock, so reservations compete
atomically for shared headroom. All accounting is exact NUMERIC, not float.

Prices are reviewed immutable versions with currency, category/unit rates, billing
rounding/minimum, limits and dated EUR conversion assumptions. Missing/expired prices
fail closed. Cache-hit discounts are not assumed in the maximum quote. Reservations
include a 10% buffer and upward rounding to six EUR decimals. A verified zero price
is tracked explicitly; a missing price/receipt is never treated as zero.

Reserve requires a current job lease, verified beta member, current provider/capability
approval and fallback opt-in when used. Begin rechecks these and budget headroom.
The current runtime cannot pass the disabled global gate. Source consent, regional
availability, safety validation and actual transport remain further dispatch gates;
a reservation alone never authorizes a network request.

States: reserved -> started -> estimated -> reconciled; a started call can become
unknown and be reconciled later. Only never-dispatched reservations can be released
or expire (five minutes). Unknown/started holds survive month rollover and account
deletion until evidence resolves their charge. Owner deletion removes attribution,
not the application's cost, preventing a budget reset by deleting an account.

Usage/receipt reconciliation is idempotent and rejects conflicting/duplicate provider
request IDs. Actual amounts can exceed the estimate; record them honestly, then stop
new calls when headroom is gone. These are conservative application controls, not
a guarantee against delayed provider invoices or charges outside this app.

Tests use fictional prices, reviews and actors in an isolated database. Real pricing,
provider terms and spend limits must be reviewed before paid activation. No financial
or private conversation content belongs in this ledger.

## Private controls and operator reporting

Settings shows the signed-in user's posted estimates/reconciled cost, reserved and
unresolved amounts, unknown holds, own ceiling remaining, last reconciliation and
last 50 attempts. It exposes no other user's usage, global remaining balance or
provider request IDs. Limits are a safety ceiling, not prepaid money or an allocation
of the shared project budget. Shared application limits can still stop a request.
Users can pause future requests or choose a personal ceiling from EUR 0 to EUR 20;
revision checks reject stale edits. Neither action enables the global runtime.
Free static mock check-ins remain available while paid AI is paused/exhausted.

50/80/95% thresholds appear as in-app status messages, including held amounts. No
emails/messages are sent. The operator-only function returns project month totals,
unknown count, provider breakdown and task-type costs without owners or private text:

```sql
select companion_private.ai_budget_admin();
```

Only an existing database administrator can call this function; no public admin API
or broader account-data access is created. The metering role cannot browse tables.

## Retention and recovery

The single cron runs bounded maintenance before the existing mock consumer. Reserved
attempts expire after five minutes if never started. Timed-out started attempts become
unknown; their holds do not expire. Terminal reconciled/cancelled detail older than
90 days is compacted into account-free monthly EUR totals retained for 12 completed
calendar months. Confirmed archived costs still count in accounting. Active unknown
or unreconciled estimated charges retain the minimum operational record until
resolved; they must not be silently discarded as zero merely to meet a cleanup date.
No journal/chat/file/recording content or auth secrets enter the ledger.

Reconciliation uses trusted provider evidence, not user-entered charges. The current
API settles a receipt once, accepting exact replays and rejecting conflicting changes.
Provider import authentication, later invoice corrections/adjustments and full billing
export comparison remain activation work. Detailed receipt deduplication applies
while detail is retained; expired task leases prevent replay of old tasks after
compaction. Do not import old invoices into new attempts to bypass deduplication.

## Scope and evidence

- Real PostgreSQL budget coverage: competing reservations,
  stale leases, live-off/consent/price denial, duplicate attempts/receipts, unknown
  holds across month rollover, retries/fallback, zero-price usage, cache worst-case,
  USD conversion, units, limits/pauses, actual overruns, ownership, account deletion,
  retention and idempotent reconciliation.
- Browser with real SQL: private ceiling/pause save and reload, B cannot read A's
  settings, empty ledger, and mock check-ins still work while paid AI is paused.
- Hosted ai_budget.sql uses a fictional actor, temporary fictional price/consent and
  admin invocation of metering functions, then ROLLBACK. The deployed global switch
  stays false, with no prices or live processors configured. Restricted-role and
  concurrency evidence comes from local PostgreSQL, not a live processor request.
- The seven catalogs contain draft translations; native/safety review remains pending.

Current price categories cover input/cached/output tokens or one of seconds/pages/
characters/requests, with rounding/minimum and a fixed dated EUR conversion. Provider-
specific extra billing categories (such as cache-write tiers), invoice imports and
real account-level spend caps must be modeled/tested for the selected processor
before activation. No prices in the test fixtures are claims about current vendors.
The free Postgres worker is still static-mock-only; no network AI belongs there.

References checked 2026-11-17:
https://www.postgresql.org/docs/17/explicit-locking.html
https://www.postgresql.org/docs/17/datatype-numeric.html

Dormant adapter integration: DEEPSEEK-ADAPTER.md now documents a server-only
fixed-input solo draft service with real SQL reservation/reporting and safety
hooks. No provider calls or activation occurred. Saved-source retrieval, evaluated
safety, reviewed live pricing/terms, invoice integration and runtime activation remain
separate gates; the static Postgres worker never invokes this adapter.

Worker publication now requires a matching known-usage attempt within reserved
bounds and current safety/provider review. Publication receipts hold only a content
digest and safety policy/review IDs, inheriting accounting retention. No prompt or
draft text enters the ledger. Unknown/dispatched attempts cannot be auto-replayed
by worker recovery; mock consumers cannot substitute output for AI-tagged jobs.
See SAFETY-WORKER.md; live AI remains off.
