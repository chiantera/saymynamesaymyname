# Migration history

Apply SQL in lexical timestamp order. Create new files with the pinned Supabase v2
CLI migration command; never rewrite an applied migration. Current additions cover
private auth/reflections, membership, sharing, queue/leases, scheduling, worker health
and recovery/cron. Hosted cron installation is conditional on pg_cron availability;
vanilla local fixtures omit the extension and test tick functions directly.
