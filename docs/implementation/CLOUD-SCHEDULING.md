# Durable scheduling and Frankfurt worker



## Milestone 1 — durable queue



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





## Milestone 4 — recovery, UI and hosted installation



Settings exposes off-by-default schedules, cadence, quiet hours, cap, pause and

worker readiness. Cloud queue generation and cancellation are separate from instant

private preview. A completed job means a draft is ready, not that an entry was

approved or a message delivered. Saving schedules cancels superseded scheduled work.



Hosted migrations and the active `companion-cloud-tick` cron are installed. Every

minute the tick expires stale jobs/prompts, rejects invalid scheduled memberships

and resumes only eligible snoozes. It dispatches new work only while the worker

heartbeat is less than two minutes old. No worker means no automatic generation.

Membership changes and provider gates never become implicit recipient grants.



Operational checks (administrator only): inspect cron.job for the named one-minute

job and cron.job_run_details for failures. Inspect minimized private cloud_jobs counts

by status/attempts/age and worker_health timestamp. Do not export private text into

logs. A failed job is terminal after three claims; cancellation invalidates leases.

Stop a compromised worker, rotate its dedicated login and wait out the old lease;

never grant it Auth/journal tables or substitute an administrator DSN to fix access.

When restoring state, replay cancellations/deletions before enabling the worker.

Do not blindly requeue finished jobs or replay old scheduled slots.



Tests: 34 isolated PostgreSQL tests, sequential Auth and three-account browser

flows, production TypeScript/build and seven draft catalogs. Hosted smoke uses

only fictional users and rolls back; it refuses to claim if real work is active.

Its worker functions run through the MCP administrator; local subprocess tests

prove the restricted role. No real Render login or live worker has been verified.

The platform prevents this admin session from SET ROLE companion_worker; the smoke

does not widen role memberships just to manufacture hosted-role evidence.



Render GitHub OAuth sign-in and workspace access were verified during final checks.
No background service was created. To activate: confirm the actual hosting quote, provision the

restricted login and store WORKER_DATABASE_URL privately, deploy the validated

Frankfurt blueprint, verify heartbeat/recovery and a fictional queued check-in, then

let a tester explicitly enable their own schedule. Native Android, provider consent/

cost controls, external channels and broader account/backup work remain Phase 0/1

work. Do not describe this infrastructure slice as beta readiness.

Render dashboard quote verified: $7/month for 0.5 CPU / 512 MB. No service
was created; restricted database-login provisioning and the separate infrastructure
budget gate still apply. Existing security-advisor leaked-password WARN remains;
new private tables have deliberate RLS/no-client-policy INFO notices (11 total).
