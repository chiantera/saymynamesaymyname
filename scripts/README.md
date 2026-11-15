# Development scripts

`dev.mjs` launches the local fictional frontend/API/SQLite worker.
`check-locales.mjs` checks catalog parity and nonempty UTF-8 text. These scripts do
not start a cloud scheduler or provision Render. The cloud worker entry point is
`uv run --directory backend python -m app.cloud_worker`; consult its configuration
runbook before use. Never pass production credentials as command-line arguments.
