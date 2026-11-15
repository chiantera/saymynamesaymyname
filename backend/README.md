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
