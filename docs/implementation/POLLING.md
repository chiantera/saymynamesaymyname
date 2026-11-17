# Client polling

Periodic reads are completion-driven and never perform sends or AI work. Cloud
Home refreshes every 30 seconds while idle and every 5 seconds while a queued or
processing job is observed. The local fictional demo retains a 1.5-second cadence.
Failures back off to 30 then 60 seconds. Sharing, membership and safety notices use
the same visibility-aware helper at the idle cadence. Hidden tabs schedule no new
reads; an already-started request may finish. Returning triggers one fresh read,
without replaying missed ticks. Each poller permits only one in-flight cycle.

The main and sharing batches each verify the user once through `auth.getUser()`.
Every subsequent data operation still checks the captured account generation
before and after its result. No cached identity replaces server authentication,
RLS or execution-time checks. Main refresh includes the owner-only job list so
active queue state is real, not inferred from a timer. Manual changes still refresh
immediately; returning Home also refreshes immediately. Request sequencing continues to reject older results.

Sharing still closes opened content/review on visibility changes and revalidates
recipient grants before reads/actions. A stale response cannot authorize a share.
Polling does not enable schedules, processors, live AI or network transport.

Pure clock tests cover slow-request serialization, cleanup, hidden/resume behavior,
active/idle delays and recovery/backoff. The production-build auth fixture counts
actual intercepted requests over bounded observation windows, checks active jobs
and suppresses hidden-tab data polling. Auth/account-switch and real SQL-backed
sharing/revocation browser regressions passed locally. Browser builds are serial.
