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
It has no public route; the Python worker has a disabled AI branch, and default
safety/live gates deny.
The saved local key is not automatically loaded. See
[DeepSeek adapter](../docs/implementation/DEEPSEEK-ADAPTER.md).

Safety/worker wiring: `app/safety.py` validates exact solo input, blocks risk
indicators and requires fresh bound local output assessment. `cloud_worker.py`
selects mock by default; the disabled AI branch uses current SQL checks before
private pending publication. No production assessor or paid host is activated.
See ../docs/implementation/SAFETY-WORKER.md.


Crisis resources and private safety notices: see
[CRISIS-SUPPORT](../docs/implementation/CRISIS-SUPPORT.md). The static help panel
works outside authentication, selects country only on user input and hides expired
emergency numbers. Private notices store allowlisted metadata only. Topic advice
and automatic crisis responses require professional locale review; live AI stays
off. No automatic contact, location lookup or third-party widget is introduced.
