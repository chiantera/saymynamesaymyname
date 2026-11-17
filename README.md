# saymynamesaymyname

A personal-growth and relationship companion built around a timely check-in loop.
Solo use is complete: relationships are optional, user-defined and can have any
number of members. The interface makes no assumptions about gender, orientation
or relationship structure.

[Open the app](https://saymynamesaymyname.vercel.app) · [Current status](CURRENT-TASK.md)
· [Product plan](PLAN.md) · [Implementation guides](docs/implementation/README.md)

This is a Phase 0/1 prototype with an invite-only cloud beta. **Live AI is disabled.**
Hosted check-ins use a static mock catalog. Growth and Bartender screens are
previews; they are not functioning counseling or personal-growth services.

## What works

- Review, edit, save, skip or snooze a private check-in; silence defaults to skip
  after 30 minutes. Saving creates one private reflection; skipping creates none.
- Web email/password and Google sign-in, verified beta admission, password recovery
  and private saved-reflection sync. Beta admission and relationship invitation are
  separate gates. Wider email delivery and native auth still need release testing.
- Optional relationships: any member can propose an invitation, every current
  member approves, and the verified intended recipient explicitly accepts.
- Personal archive/mute, immediate leaving and pairwise blocking. A blocking B does
  not stop B and C from communicating. Membership never grants content access.
- Explicit read-only reflection sharing with named recipients, revocation and
  source/access checks. New members do not inherit historical sharing audiences.
- Durable PostgreSQL schedules, leases, expiration, pause/quiet-hour controls,
  private drafts and a bounded static mock consumer on the existing Frankfurt cron.
  Schedules remain opt-in. Render is retained as a later worker option.
- Private AI consent settings, provider/capability review gates, budget limits,
  atomic reservations and a usage ledger. These foundations do not activate AI.
- Italian, Spanish, Korean, Mandarin/Simplified, Cantonese/Traditional, English and
  German catalogs, responsive themes and accessibility checks. Copy is still draft.
- Static support resources before sign-in, explicit temporary country selection,
  expiring sourced contacts and quick exit. Professional review still gates
  topic-specific crisis advice and automatic responses. The app contacts nobody
  automatically and is not an emergency service.

Cloud reads back off while idle or failing, pause in hidden tabs and refresh on
return. Each refresh batch verifies identity and rejects account changes. Enforced
security headers block inline scripts, unauthorized connections and framing.

## Runtime boundaries

| Surface | Current implementation |
| --- | --- |
| Local demo | React/Vite, local-only FastAPI and a SQLite mock worker; fictional data only |
| Hosted preview | Vercel static web client with isolated fictional browser storage |
| Private cloud | Browser Supabase Auth/RPC/RLS access to owned reflections, membership, grants and jobs |
| Scheduled composition | Bounded static mock execution in the dedicated Frankfurt database |
| DeepSeek | Server adapter and Python worker branch exist; live/network/review gates deny by default |
| Android | Capacitor configuration exists; native build/device/auth/push verification is pending |

No paid worker, live provider or outward messaging is activated. Upload/OCR, voice,
Drive import, full bartender chat/tools, richer goals, media, exports, deletion UI
and external delivery channels remain later work. The current Vercel deployment
does not run the local FastAPI server as a production backend.

## Run locally

Install Node 24 and uv. From the repository root:

```powershell
npm --prefix frontend ci
uv sync --directory backend --locked --python 3.12
npm run dev
```

Open http://127.0.0.1:5174. The command starts Vite, the local API and a separate
mock worker. Local data stays in ignored `.local/`; do not enter sensitive real
information in the fictional preview. Stop the launcher to stop its child processes.
No API key, cloud account or paid service is needed.

Use [.env.example](.env.example) for optional local configuration. Only publishable
client configuration may use `VITE_*`. Never put service-role keys, provider keys,
passwords or recovery links into source, screenshots, logs or frontend variables.
Google identity sign-in does not authorize Drive or Calendar access.

## Test and build

```powershell
npm run check
npm run test:browser
npm run test:auth
npm run test:database
npm run test:membership
```

`check` validates documentation links, catalogs, frontend/backend units and the
production build. Browser suites use fictional data; auth is intercepted. Database
suites require an isolated loopback PostgreSQL fixture and refuse hosted test DSNs.
Run browser/build suites sequentially. Test commands print their actual counts;
prose does not duplicate a changing total. See [testing](docs/TESTING.md).

GitHub CI runs the full validation pipeline. Pushes to `main` trigger Vercel's Git
integration. A green build, deployment readiness and actual production responses
are checked separately; a deployed URL alone does not prove private beta readiness.

## Privacy and safety

Owned content stays private unless the user explicitly shares an item with exact
recipients. Retention, membership, sharing and AI-provider/context consent are
separate. Server authorization rechecks blocking, membership, revocation, consent,
lease and budget at execution. Unknown paid-call outcomes retain accounting holds.

Transport and managed storage encryption are the model; **do not assume end-to-end
encryption**. Authorized backend/provider processing can read authorized content.
Uploads/OCR are untrusted data, never instructions. No partner tracking or coercive
control is permitted. Unsafe generated output is not a diagnosis of the user;
private notices do not expose rejected text or notify partners/support staff.

[Safety specification](docs/plan/SAFETY.md) · [Crisis resources](docs/implementation/CRISIS-SUPPORT.md)
· [Security headers](docs/implementation/SECURITY-HEADERS.md).

## Documentation and contribution

- [CURRENT-TASK](CURRENT-TASK.md): present capabilities, phase status and release gates.
- [PLAN](PLAN.md): topic index for accepted product requirements and defaults.
- [Phase 0/1](docs/implementation/PHASE-0-1.md): execution scope and acceptance checklist.
- [CHANGELOG](docs/CHANGELOG.md): concise dated milestones, separate from current status.
- [Decision records](docs/decisions/README.md): architectural choices and consequences.
- [AGENTS](AGENTS.md): the single working guide for coding agents; CLAUDE.md points to it.
- [DESIGN](frontend/DESIGN.md): the frontend design contract.

The sibling `schedapro/` repository is our reusable source, excluded from this
repository. Adapt it freely while preserving this app's stronger safety/privacy
rules. Branding and public prices are deferred. Operational identifiers, account
narratives, credentials and raw private transcripts do not belong in public docs.

## License

[MIT](LICENSE).
