# Local unit/API tests

`npm run test:backend` runs these tests against temporary SQLite databases and local
FastAPI fixtures. They verify local authorization, decision races and scheduling
rules. They do not prove Supabase RLS or Render deployment; see ../dbtests/.
