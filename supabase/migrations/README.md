# Migration history

Apply SQL in lexical timestamp order. Create new files with the pinned Supabase v2
CLI migration command; never rewrite an applied migration. Current additions cover
private auth/reflections, membership, sharing, queue/leases, scheduling, worker health
and recovery/cron. Hosted cron installation is conditional on pg_cron availability;
vanilla local fixtures omit the extension and test tick functions directly.

Current mock execution: the same hosted cron now calls a bounded Postgres consumer
inside the existing Frankfurt project. It uses private static catalogs and the
existing leased queue. Render/Python remain available for later; no paid service
or external AI is needed for this interim mode.
