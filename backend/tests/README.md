# Local unit/API tests

`npm run test:backend` runs these tests against temporary SQLite databases and local
FastAPI fixtures. They verify local authorization, decision races and scheduling
rules. They do not prove Supabase RLS or Render deployment; see ../dbtests/.

`test_ai_adapter.py` adds 31 isolated DeepSeek transport/composition checks with
fictional keys and MockTransport. Tests cover disabled defaults, inclusive prompts
in seven locales, safety verdicts/unavailability, retries forbidden, unknown costs,
receipt/output validation and revocation. They never read the private real key.
The full local backend suite has 55 tests.
