# Backend

`app/main.py` is the local-only FastAPI demo. `app/repository.py` uses SQLite for
fictional local data; it is not the cloud database. `app/worker.py` is its separate
local mock worker. Run all three local processes using `npm run dev` at the root.

Production durable jobs live in Supabase, not in FastAPI background tasks. Worker
functions run under a separate restricted database role with no direct access to
Auth, private journals, grants or queue tables. Worker runtime and deployment
instructions are tracked in [CLOUD-SCHEDULING](../docs/implementation/CLOUD-SCHEDULING.md).

Tests: `npm run test:backend` for local behavior; `npm run test:database` for real
PostgreSQL authorization/concurrency; `npm run test:membership` for browser plus SQL.
No production credentials belong in source or test fixtures.

Current mock execution: the same hosted cron now calls a bounded Postgres consumer
inside the existing Frankfurt project. It uses private static catalogs and the
existing leased queue. Render/Python remain available for later; no paid service
or external AI is needed for this interim mode.

Server-side AI adapter: `app/ai.py` implements dormant solo draft composition with
execution-time SQL consent/lease checks, local safety hooks and committed metering.
It has no public route or worker hookup; default safety and all live gates deny.
The saved local key is not automatically loaded. See
[DeepSeek adapter](../docs/implementation/DEEPSEEK-ADAPTER.md).
