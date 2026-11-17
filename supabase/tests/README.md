# Hosted transactional smoke

membership.sql, sharing.sql and cloud_worker.sql use synthetic example.invalid
actors and ROLLBACK. cloud_worker.sql refuses to claim while any real active job
exists. Hosted MCP invokes worker functions as database administrator; restricted
worker-role execution and actual process restart are verified in local Postgres.
These tests do not prove a live Render deployment or end-user external delivery.

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

`deepseek_adapter.sql` is a read-only hosted smoke of the dormant kill switch
and metering-role-only authorization function. It refuses a live-enabled runtime
and never creates a provider request, user, price, usage row or temporary activation.

`safety_worker.sql` checks disabled AI/safety review and restricted worker/helper
permissions without claiming a job, creating a review or invoking any processor.
