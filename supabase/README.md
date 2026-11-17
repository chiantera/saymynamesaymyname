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

Current mock execution: the same hosted cron now calls a bounded Postgres consumer
inside the existing Frankfurt project. It uses private static catalogs and the
existing leased queue. Render/Python remain available for later; no paid service
or external AI is needed for this interim mode.

AI consent foundation: Settings and guarded SQL persist private source preferences,
reflection exclusions and versioned provider/capability/fallback approval. Real
provider controls remain unavailable pending review. Details: docs/implementation/AI-CONSENT.md
at repository root. No mock-worker journal access or external AI activation.

Budget integration adds owner-only usage/ceiling/pause controls and a separate
restricted accounting role. Exact reservations and unresolved holds are tested with
fictional prices; live AI is disabled. See docs/implementation/AI-BUDGET.md at root.

The dormant DeepSeek adapter has one private metadata-only authorization function,
callable by companion_meter, not clients or companion_worker. It never returns
journal text, enables processors or changes the mock cron. See the implementation
guide DEEPSEEK-ADAPTER.md for hosted denial/ACL evidence and activation requirements.

Safety/worker migration adds a private disabled safety-policy review and explicit
job processor routing (mock default). The metering role receives only a narrow
AI claim/authorize/publish/hold function. Mock workers cannot finish AI jobs; the
shared finish helper is ungranted. No login, provider or cron is activated.
