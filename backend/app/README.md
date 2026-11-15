# Runtime modules

- main.py: local-only FastAPI adapter, guarded by development flags and local origin.
- repository.py: SQLite fictional-data repository and local scheduling reference.
- worker.py: local mock worker, including local demo dispatch.
- cloud_worker.py: separate restricted Postgres worker; only claims/composes/finishes.

Supabase cron is the sole production due-scan scheduler. Never add cloud dispatch
to the request process or cloud worker. Cloud composition is static mock text;
provider consent, budget reservations and live AI evaluations remain future work.

Current mock execution: the same hosted cron now calls a bounded Postgres consumer
inside the existing Frankfurt project. It uses private static catalogs and the
existing leased queue. Render/Python remain available for later; no paid service
or external AI is needed for this interim mode.
