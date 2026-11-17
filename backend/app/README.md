# Runtime modules

| Module | Responsibility |
| --- | --- |
| `main.py` | Guarded local-only FastAPI demo routes |
| `repository.py` | Fictional SQLite data and scheduling reference |
| `worker.py` | Local mock worker/dispatch |
| `cloud_worker.py` | Restricted durable cloud consumer, default mock |
| `ai.py` | Dormant fixed-input DeepSeek transport, authorization and accounting |
| `safety.py` | Structural/risk checks and exact reviewed-assessment binding |
| `crisis.py` | Static typed safety routing, never diagnosis or emergency dispatch |

Supabase cron is the sole hosted scheduler. Do not add dispatch to request handlers
or put slow/network AI in Postgres. Source retrieval and outward sends are not
implemented here. [Worker contract](../../docs/implementation/SAFETY-WORKER.md),
[crisis contract](../../docs/implementation/CRISIS-SUPPORT.md),
[testing](../../docs/TESTING.md).
