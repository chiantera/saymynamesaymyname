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
