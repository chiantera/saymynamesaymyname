# Backend

`app/main.py` is the local-only FastAPI fictional demo; SQLite lives in ignored
`.local/`. `app/worker.py` is its separate mock worker. `npm run dev` launches them
with Vite. These are not the hosted cloud database or a deployed FastAPI service.

`app/cloud_worker.py` is a restricted PostgreSQL consumer. Mock is the default;
the DeepSeek branch, network transport and review gates remain disabled. The
hosted free executor is currently the bounded static Postgres consumer, with
Render retained for later. No module loads a saved local API key automatically.

See [free cloud research](../docs/implementation/FREE-CLOUD-RESEARCH.md) for
unselected alternatives and the requirements before changing worker hosting.

- [Runtime modules](app/README.md)
- [Unit tests](tests/README.md), [real SQL/browser fixtures](dbtests/README.md)
- [Browser scripts](scripts/README.md)
- [Testing commands](../docs/TESTING.md)
- [Cloud scheduling](../docs/implementation/CLOUD-SCHEDULING.md)
- [Dormant adapter](../docs/implementation/DEEPSEEK-ADAPTER.md)

Keep `httpx2`: Starlette's TestClient uses it. The AI transport separately pins
`httpx`. Use locked dependencies, mocked processors and loopback fixtures; never
point tests at beta data or log private text, credentials or provider exceptions.
