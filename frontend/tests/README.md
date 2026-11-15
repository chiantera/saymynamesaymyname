# Frontend domain tests

Node's built-in test runner covers locale selection, safe auth redirects, PKCE slot
handling, invitation-link secrets and generation eligibility. `npm test` runs them
with catalog checks. Browser behavior and real database authorization are exercised
by backend/scripts and backend/dbtests, rather than source-mirroring unit tests.
