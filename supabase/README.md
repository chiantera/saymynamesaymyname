# Supabase

Dedicated Frankfurt project; Auth, private Postgres state and eventual private file
storage. `migrations/` is ordered immutable migration history. Generate new files
with `npx --yes supabase@2 migration new <name>`; test locally before hosted apply.
Never edit an already-applied migration to alter a running database.

Public originals remain owner-only under RLS. Membership and sharing tables are in
the non-exposed `companion_private` schema with no client table grants. Narrow public
security-invoker RPCs call guarded private functions. The worker role has only the
execution permissions needed for job claims/completion, never general table access.

`tests/` contains hosted smoke SQL that creates only synthetic actors in a transaction
and ends with ROLLBACK. `backend/dbtests/` creates a disposable loopback database;
its DSN guard deliberately refuses hosted targets. See the cloud scheduling runbook
for migration, cron and worker activation evidence.
