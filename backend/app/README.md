# Runtime modules

- main.py: local-only FastAPI adapter, guarded by development flags and local origin.
- repository.py: SQLite fictional-data repository and local scheduling reference.
- worker.py: local mock worker, including local demo dispatch.
- cloud_worker.py: separate restricted Postgres worker; only claims/composes/finishes.

Supabase cron is the sole production due-scan scheduler. Never add cloud dispatch
to the request process or cloud worker. Cloud composition is static mock text;
provider consent, budget reservations and live AI evaluations remain future work.
