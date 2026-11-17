# Real PostgreSQL and browser fixtures

`npm run test:database` runs the non-browser SQL suites. `npm run test:membership`
runs the production client against fake Auth/HTTP backed by real SQL/RLS. The latter
also validates sharing/revocation, private notices, queue transitions and security
headers. Its transport commits before returning a response, matching PostgREST.

The fixture accepts only loopback `companion_test`, creates a generated disposable
database, applies migrations and drops only that database. Credentials stay in
ignored local configuration or the CI service environment. Hosted DSNs are refused.

Do not run builds/browser suites concurrently. Do not replace the explicit SQL
file list blindly with `pytest dbtests`: that would also run the browser case.
Counts come from test output; collection alone is not execution.
[Fixture prerequisites](../../docs/TESTING.md).
