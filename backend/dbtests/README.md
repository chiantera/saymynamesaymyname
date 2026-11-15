# Real PostgreSQL and browser tests

The fixture accepts only a loopback companion_test DSN, creates a disposable database,
applies all migrations, then drops that generated database. Each test removes only
its synthetic actors; no hosted beta data is used. Credentials stay in ignored local
configuration or CI service environment, never in tracked fixtures.

`npm run test:database` covers membership, sharing, queue leases, scheduling and
worker subprocess restarts (34 tests). `npm run test:membership` builds the real
client with fake Auth/HTTP endpoints backed by real SQL/RLS. Its transport commits
before returning a response, matching PostgREST transaction ordering. Browser builds
share dist: do not run auth/membership/browser suites concurrently.
