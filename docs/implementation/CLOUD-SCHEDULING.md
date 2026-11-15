# Durable scheduling and Frankfurt worker

## Milestone 1 â€” durable queue

Implemented private jobs with per-owner idempotency keys, one active job per owner,
90-second fenced leases, three-claim limit, expiry and explicit cancellation. A
restricted NOLOGIN `companion_worker` role can claim and finish; neither it nor
clients can read/write queue tables directly. Authenticated clients see only their
own minimized job status. Completion creates one private check-in atomically.

Relationship-scoped jobs bind to the membership generation. Leave/archive/mute or
loss of verified beta admission prevents publication. These are private check-ins
for the requesting owner, never messages to other members or sharing grants.

Runtime credentials, Render provisioning and cron activation are separate from
schema installation. Production AI, outward delivery and paid provisioning are not
enabled merely by applying migrations. Further milestone evidence is appended here.


## Milestone 2 — scheduling rules

Schedules start disabled. Explicit owner settings use revision checks, 3–12-hour
cadence per scope, personal pause/until, quiet hours and a global cap (default 3).
The dispatcher visits least-recently-presented scopes first and queues at most one
job per owner. Successful scheduled publications, rather than retries, count toward
the local-day cap and cross-scope gap. Quiet windows use the user's validated IANA
timezone; local-day boundaries therefore follow daylight-saving changes.

A settings revision cancels queued/claimed scheduled work and pending/deferred
scheduled prompts. Manual requests are separate. Settings do not enable outward
messages, AI calls or content sharing. SQL tests use synthetic instants and actors.
The worker rechecks scheduling and membership before publication, not just enqueue.


## Milestone 3 — separate mock worker

`backend/app/cloud_worker.py` is a standalone process, not a request background
thread. It reconnects with bounded exponential backoff, stops on SIGTERM/SIGINT,
and publishes only static localized mock text. Queue leases survive process death;
no local disk is the authority. Errors are fixed codes, without raw DB exceptions.
Subprocess tests restart the worker twice per locale and verify exactly seven
private results across seven catalogs, with no duplicates on a second run.

Production configuration requires `WORKER_REGION=frankfurt` and a restricted
`WORKER_DATABASE_URL` for this project's Frankfurt direct/pooler host. TLS hostname
verification is mandatory. Postgres/admin logins are refused. Provision a dedicated
NOINHERIT login that can SET ROLE companion_worker; give it no direct table grants,
no role administration and no BYPASSRLS. Keep its password only in Render secrets.
The runtime executes SET ROLE companion_worker before any application operation.
Do not use a Supabase service key, database administrator or frontend credential.

`render.yaml` specifies a background worker in Frankfurt, mock mode only, locked
Python dependencies and checks-passed auto deployment. No public listener exists.
The starter compute plan is a billable resource: validate its current quote against
the separate infrastructure budget before provisioning. Render credentials and a
restricted DB login were not available in this session's process environment;
therefore the blueprint is deployment-ready source, not proof of a running service.

Heartbeat is one private row with a two-minute freshness window. Admitted clients
can see only `{ready, mode}`, never credentials or worker internals. A stale worker
is reported as unavailable; an installed schema alone cannot claim readiness.

References verified 2026-11-15:
https://supabase.com/docs/guides/cron
https://render.com/docs/background-workers
https://render.com/docs/regions
https://render.com/docs/blueprint-spec
https://render.com/pricing
