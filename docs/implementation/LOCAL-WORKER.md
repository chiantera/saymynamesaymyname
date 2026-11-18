# Local AI worker (testing)

Implements [decision 0005](../decisions/0005-local-ai-worker-for-testing.md): the
operator's computer runs the restricted AI worker against the Frankfurt database.
**Live AI remains disabled.** Following this runbook connects the worker; it does
not open any AI gate, and with today's gates it exits without calling a provider.

## What runs where

| Piece | Where | Change |
| --- | --- | --- |
| Scheduler and queue | Existing one-minute Supabase cron | None |
| Mock drafts | Postgres free tick | None |
| AI drafts | `app.cloud_worker` in `deepseek` mode on your machine | New launcher only |

`backend/app/local_worker.py` loads `.local/worker.env`, refuses unknown keys and
the test-only switches, forces AI mode and production settings, and starts the
existing worker. It prints fixed status codes only.

## One-time setup

1. **Create the restricted login** (operator, in the Supabase SQL editor). Choose the
   password in your password manager; do not paste it into chat or commit it.

   ```sql
   create role companion_ai_worker_login
     login noinherit connection limit 2 password '<from your password manager>';
   grant companion_meter to companion_ai_worker_login;
   ```

   It receives no table grants, no other role and no `BYPASSRLS`. It can do nothing
   until it runs `SET ROLE companion_meter`, which the worker does on connect.
   It is deliberately not granted `companion_worker`, so it cannot become a second
   mock consumer.

2. **Download the database CA certificate** from the project's database settings
   (SSL configuration) and save it as `.local/supabase-ca.crt`. The worker requires
   full TLS hostname verification.

3. **Write `.local/worker.env`** (the whole `.local/` folder is git-ignored). Use the
   session pooler on port 5432: it works on IPv4 networks and keeps one connection
   per session, which `SET ROLE` needs. The transaction pooler (6543) does not fit.

   ```ini
   WORKER_DATABASE_URL=postgresql://companion_ai_worker_login.<project-ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   WORKER_REGION=frankfurt
   PGSSLROOTCERT=.local/supabase-ca.crt
   ```

   The pooler host prefix (`aws-0` or `aws-1`) is shown in the project's connect
   panel. The worker refuses any other host, an administrator login, or a pooler
   user for another project.

4. **Check the connection.** It connects, assumes the metering role and claims
   nothing:

   ```powershell
   npm run worker:check
   ```

   Expect `connection_ok`, then `ai_gates_open:` followed by every gate that is
   still closed. Any other first line is a fixed code; see the table below.

## Running

```powershell
npm run worker:local
```

Supply the provider key only in that terminal's environment when the gates are
open (for example from your password manager), never in `.local/worker.env`; the
launcher refuses it there. Stop with Ctrl+C: the worker exits cleanly and any
claimed lease expires and is recovered by the existing rules.

Today this exits with `live_ai_disabled` or `safety_unavailable`. That is expected.

## What must be true before it does real work

Each is an existing gate, recorded in [safety worker](SAFETY-WORKER.md),
[DeepSeek adapter](DEEPSEEK-ADAPTER.md) and [AI budget](AI-BUDGET.md):

1. Processor terms reviewed and a reviewed price row for the model and region.
2. The tester's own provider consent for chat drafting.
3. The database safety review enabled for the supported locales.
4. An evaluated **local** safety assessor installed and passed to the worker. None
   ships today, and environment switches cannot substitute for it.
5. An authorized producer that tags a tester's own jobs as AI jobs. None exists:
   every job is mock by default and nothing reroutes it.
6. The live, terms, safety-evaluated and network switches set in the env file, and
   `AI_PRICE_ID` set to the reviewed price.

## Status codes

| Code | Meaning |
| --- | --- |
| `env_file_missing` | Create `.local/worker.env`. |
| `env_file_outside_local`, `env_file_not_ignored`, `env_file_tracked` | The file must be the ignored `.local/worker.env`. |
| `env_key_forbidden:<KEY>` | That key may not come from the file (provider key, test switches, mode). |
| `env_key_unknown:<line>`, `env_line_invalid:<line>`, `env_key_duplicate:<KEY>` | Fix that line. |
| `ssl_root_cert_invalid` | The certificate path must exist under `.local/`. |
| `worker_configuration_required` | Wrong host, region, project or an administrator login. |
| `connection_or_role_unavailable` | Network, TLS, password, or the login lacks `companion_meter`. |
| `live_ai_disabled`, `safety_unavailable` | Expected until the gates above are open. |

## Rotation and removal

If the machine is lost or the env file may have leaked, change or drop the login
(`alter role companion_ai_worker_login password ...` or `drop role ...`), then wait
for any outstanding lease to expire. Never fix access by using an administrator DSN.

## Tests

`backend/tests/test_local_worker.py` covers file location and git-ignore checks,
the key allowlist, refusal of the provider key and test switches, forced AI mode,
certificate placement and that output never contains a secret. The worker's own
restricted-role, routing and publication behaviour is covered by the existing
database tests. The hosted connection itself is verified only by running
`npm run worker:check` on the operator's machine.
