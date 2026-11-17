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
