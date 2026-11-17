# Real PostgreSQL and browser tests

The fixture accepts only a loopback companion_test DSN, creates a disposable database,
applies all migrations, then drops that generated database. Each test removes only
its synthetic actors; no hosted beta data is used. Credentials stay in ignored local
configuration or CI service environment, never in tracked fixtures.

`npm run test:database` covers membership, sharing, queue leases, scheduling and
worker subprocess restarts (56 tests). `npm run test:membership` builds the real
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
