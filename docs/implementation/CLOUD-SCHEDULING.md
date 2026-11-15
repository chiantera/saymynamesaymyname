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
