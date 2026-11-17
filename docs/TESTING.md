# Testing and evidence

Run from the repository root with Node 24, uv-managed Python 3.12 and installed
frontend dependencies. Use committed lockfiles. Live AI remains disabled; fixtures
use fictional text, mocked HTTP and synthetic identities, never real provider keys.

| Command | Coverage | Needs |
| --- | --- | --- |
| `npm run check` | Local documentation links, catalog/source contracts, frontend/backend unit tests, TypeScript and production build | Node, uv, installed dependencies |
| `npm test` | Catalog parity/interpolation/encoding and pure frontend tests | Node |
| `npm run test:backend` | Local API, loop, scheduling, adapter/safety/crisis and worker-gate tests | uv/Python dependencies |
| `npm run test:browser` | Fictional local API/SQLite + responsive/localization/accessibility/quick-exit browser matrix | Playwright Chromium; free ports 8003 and 5175 |
| `npm run test:auth` | Production build + intercepted signup/recovery/Google, account isolation, polling budget and enforced-header probes | Playwright Chromium; free port 5176 |
| `npm run test:database` | Real PostgreSQL authorization, concurrency, queue/recovery, consent, accounting, safety notices and edit tombstones | Isolated loopback fixture |
| `npm run test:membership` | Production build + fake Auth transport backed by real SQL/RLS, grants/revocation/blocking and enforced headers | PostgreSQL fixture, Chromium; free port 5177 |
| `npm run test:docs` | Relative Markdown targets/anchors and documentation authority contracts | Node |

Counts come from commands, not copied prose. Collection is not execution. The
database command discovers the directory while excluding `*_browser.py` files.
Those run separately because they build and start browser fixtures; name future
SQL-backed browser files with that suffix and register their separate command.

## Local PostgreSQL fixture

Use a separate PostgreSQL database named `companion_test` on `127.0.0.1` or
`localhost`. Supply its DSN through `MEMBERSHIP_TEST_DSN` or ignored
`.local/membership-db.env`. Never commit a real password. The fixture rejects hosted
hosts/other database names, creates a uniquely named disposable database, applies
migrations, inserts fictional actors and drops only that generated database.

Use the existing labeled test container if available; inspect its identity/port
before starting or stopping it. Do not restart Docker Desktop or affect unrelated
containers. CI supplies its own disposable PostgreSQL service and fixture-only DSN.

## Browser execution

Run builds and browser suites sequentially: they share `frontend/dist` and dedicated
ports. Install the locked Playwright Chromium runtime with:

```powershell
uv run --directory backend playwright install chromium
```

Linux CI additionally installs required system dependencies. Screenshots and server
logs stay in ignored `.local/`. A port conflict fails rather than killing another
process. The auth/membership Vite previews use the published security policy with
only their explicitly isolated connection origin substituted; no CSP bypass.

Use pure controllable clock tests for exact cadence/backoff/serialization. Browser
request budgets use bounded real observation windows and explicit readiness events
so SDK auth timers do not get confused with the poller's fake clock.

## Evidence boundaries

Mocks prove code mechanics, not live email/OAuth settings, clinical quality, processor
terms, invoices, native permissions or push. Hosted SQL scripts are explicit operator
smokes with documented guards, not the target of local fixture commands. Production
readiness/SHA, HTTP headers and assets are checked separately from CI. A protected
interstitial is not an application response.

Native Android, clinical/native-language review, broader auth/session recovery,
backup/export/deletion and live processor activation require their own release
checks under [Phase 0/1](implementation/PHASE-0-1.md).
