# Browser and verification scripts

- `browser_smoke.py`: local fictional FastAPI/SQLite plus responsive locale/theme,
  accessibility, check-in and quick-exit coverage.
- `auth_smoke.py`: production-build fake Auth, recovery/account isolation, actual
  polling request budgets and enforced security-policy probes.
- `ui_checks.py`: test-only accessibility instrumentation; no CSP bypass.
- `security_checks.py`: response-header and browser script/connection/framing checks.

Use root npm commands and [testing prerequisites](../../docs/TESTING.md). Scripts
reserve dedicated ports, fail on conflicts and stop only their own processes.
Run browser/build suites sequentially. Logs/screenshots stay in ignored `.local/`;
no hosted account, credential or processor is needed.
