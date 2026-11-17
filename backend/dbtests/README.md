# Real PostgreSQL and browser tests

The fixture accepts only a loopback companion_test DSN, creates a disposable database,
applies all migrations, then drops that generated database. Each test removes only
its synthetic actors; no hosted beta data is used. Credentials stay in ignored local
configuration or CI service environment, never in tracked fixtures.

`npm run test:database` covers membership, sharing, queue leases, scheduling and
worker subprocess restarts (62 tests). `npm run test:membership` builds the real
client with fake Auth/HTTP endpoints backed by real SQL/RLS. Its transport commits
before returning a response, matching PostgREST transaction ordering. Browser builds
share dist: do not run auth/membership/browser suites concurrently.

Current mock execution: the same hosted cron now calls a bounded Postgres consumer
inside the existing Frankfurt project. It uses private static catalogs and the
existing leased queue. Render/Python remain available for later; no paid service
or external AI is needed for this interim mode.

AI consent foundation: Settings and guarded SQL persist private source preferences,
reflection exclusions and versioned provider/capability/fallback approval. Real
provider controls remain unavailable pending review. Details: docs/implementation/AI-CONSENT.md
at repository root. No mock-worker journal access or external AI activation.

Budget integration adds owner-only usage/ceiling/pause controls and a separate
restricted accounting role. Exact reservations and unresolved holds are tested with
fictional prices; live AI is disabled. See docs/implementation/AI-BUDGET.md at root.

`test_deepseek_adapter.py` adds six real-SQL tests of the dormant adapter using
mocked HTTP and fictional keys. The restricted role returns metadata only, and
reserved/started cost cannot roll back after an external call. Includes kill/cap,
revocation, replay and timeout coverage. Full database suite: 62 tests.

`test_safety_worker.py` adds 14 real SQL worker scenarios with fictional local
assessments/HTTP: private pending publication, holds, review revocation, kill switch,
replay/lease isolation, mock/AI routing, ACLs and tampered receipts. Current full
database suite: 76 tests. No real processor or beta data is used.
