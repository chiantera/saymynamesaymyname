# Runtime modules

- main.py: local-only FastAPI adapter, guarded by development flags and local origin.
- repository.py: SQLite fictional-data repository and local scheduling reference.
- worker.py: local mock worker, including local demo dispatch.
- cloud_worker.py: separate restricted Postgres worker; only claims/composes/finishes.

Supabase cron is the sole production due-scan scheduler. Never add cloud dispatch
to the request process or cloud worker. Cloud composition is static mock text;
the new AI adapter is separate and dormant; live safety evaluations remain pending.

Current mock execution: the same hosted cron now calls a bounded Postgres consumer
inside the existing Frankfurt project. It uses private static catalogs and the
existing leased queue. Render/Python remain available for later; no paid service
or external AI is needed for this interim mode.

- ai.py: dormant server-only DeepSeek composition, restricted PostgresGate, fixed
  HTTPS transport, centralized prompt and fail-closed input/output safety hooks.
  No public route or activation. The Python worker has a disabled AI branch;
  no saved-source retrieval or outbound send.
  See docs/implementation/DEEPSEEK-ADAPTER.md at repository root.

- safety.py: fixed-input policy, normalized risk indicators and fresh bound local
  assessments. No rule-hit absence can approve output. No production semantic
  assessor, crisis resource UI or external safety API is implicitly configured.
