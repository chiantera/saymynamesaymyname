# Dormant server-side DeepSeek adapter

## Implemented scope

`backend/app/ai.py` implements a server-only composition service, a fixed-destination
DeepSeek HTTP transport and a restricted PostgreSQL authorization/metering bridge.
It supports **solo private check-in drafts from fixed task input only**. There is no
public route, AI queue producer, saved-context retrieval, file input, tool call,
streaming, automatic retry/fallback or outward send. Returning a draft does not mark
a check-in completed or approve it. The existing mock cron remains active; the Python worker now has a disabled AI
branch documented in SAFETY-WORKER.md.

No module import, startup, environment key or stored local key triggers a request.
The private local secrets file is not loaded or copied to hosting. `environment_key`
reads only a server-injected `DEEPSEEK_API_KEY`, on explicit invocation after initial
authorization/safety checks. Keys never use `VITE_*`, logs, journals or SQL arguments.
Do not enable HTTP wire logging or include provider exception objects in diagnostics.

All defaults deny live dispatch. `Deployment` requires separate explicit live,
terms-review and safety-evaluation approvals plus Frankfurt worker region. Transport
network access is independently off. Database live AI remains false, real prices
remain empty and provider processing remains disabled. No running host is provisioned
for this service. Frankfurt execution does not assert European DeepSeek data residency;
processor terms, countries and actual routing remain activation-review requirements.

## Authorization, consent and source boundaries

The new `deepseek_authorize` private function checks the database kill switch, current
lease/expiry/job eligibility, solo scope, reviewed enabled DeepSeek chat model/price,
current exact-version provider approval and personal AI pause. It exposes only locale,
model and review revision. It grants execution only to the existing NOLOGIN metering
role; clients and the mock worker cannot call it. It grants no journal/table access.
The connection bridge requires autocommit, an idle connection with no explicit
transaction before each call, and `current_user=companion_meter`.

The service accepts only job/lease/price IDs and attempt number; no caller-selected
owner, context text, model URL, relationship audience or saved-source IDs. Consequently
it cannot bypass journal/category exclusions by retrieving or accepting those sources.
Future saved-source support needs its own execution-time retrieval/authorization and
derived-context revocation tests; this implementation deliberately rejects that scope.

Dispatch sequence:

1. Require reviewed deployment gates and database authorization.
2. Build the immutable fixed-input request with the centralized inclusive/safety core
   and the database-selected locale/model. All seven locale preferences are supported.
3. Require affirmative input safety and available credentials, then reserve cost.
4. Recheck deployment, database authorization/review version and input safety. `begin`
   rechecks lease, provider consent and budget in a committed atomic transaction.
5. Make one bounded HTTPS request. Record valid usage **before** accepting any output.
6. Reject truncation, tools, unexpected model, reasoning text or malformed JSON. Require
   output safety and current deployment/database authorization before returning a draft.

No database transaction spans HTTP. Duplicate attempts cannot begin twice. Revocation,
lease expiry, account unavailability or a pause during processing withholds the draft
without erasing the processor charge. A future consumer must also reauthorize when
persisting/presenting output; there is no new publication or send path in this slice.

## Safety behavior and limits

The central prompt enforces solo/inclusive use, mirrors only supplied identity terms,
treats quoted/retrieved data as untrusted and forbids coercion, tracking and private-data
disclosure. Prompt text is not the safety boundary. An independent local `Safety`
implementation must affirm both input and output; missing/throwing/unknown decisions
fail closed. Refusal, self-harm, violence and stalking verdicts suppress generated text
and return static technical codes. No unsafe text or rationale is logged.

The shipped safety implementation now validates fixed input, rejects conservative
risk indicators and requires fresh text-bound local assessment for arbitrary output.
Its production assessor remains unavailable; rule absence never implies safety.
See [safety worker](SAFETY-WORKER.md); this is not a clinically validated keyword
classifier. Evaluated safety detection and professional review of the implemented
[regional support paths](CRISIS-SUPPORT.md) remain activation gates. Tests exercise verdict handling, not clinical detection quality.
A network safety service would require separate processor consent, reviewed pricing
and its own metered attempts; do not hide such a call inside the local callback.

## Transport and accounting

The transport uses pinned HTTPX, verified HTTPS at `api.deepseek.com/chat/completions`,
no environment proxies, redirects, automatic retry or tool declaration. Thinking is
explicitly disabled, JSON output requested, output capped at 512 tokens and response
limited to 64 KB. Compressed responses are rejected. Connect/read timeouts and elapsed
time checks bound network waits (a blocking read may extend past the elapsed deadline
up to its read timeout). Existing leases are 90 seconds and are rechecked afterwards.

Reservations use UTF-8 request bytes plus a 4096-token framing allowance, full output
cap and the ledger's existing 10% buffer; cache discounts are not assumed. Verify the
bound for the actual reviewed model/tokenization before enabling a route. Real prices
are not installed. Future pricing should conservatively cover peak rates, cache and
all charge categories, with dated FX assumptions and provider-native spend controls.
This remains an application target, not a guaranteed provider invoice hard cap.

Receipts require consistent integer prompt/cache/output/total counts. Unsupported
server tool charges or malformed/missing usage retain an unknown hold. HTTP failures,
timeouts, invalid envelopes and settlement outages never turn a possibly dispatched
charge into zero. Valid usage is recorded even when content is unsafe, truncated,
over-bound or revoked. Reported usage is an **estimate**, not invoice reconciliation.
Later invoice imports/corrections remain separate work. Every retry/fallback must use
a new attempt; this adapter implements neither automatically.

## Evidence — 2026-11-17

- Isolated adapter tests use fictional credentials and HTTPX MockTransport; no real
  key, provider request, balance endpoint or paid processing is used.
- Real PostgreSQL adapter tests cover committed reservation/reporting, replay,
  kill switch/cap, revocation during a mocked request, unknown cost on timeout, narrow
  role metadata and solo-only scope.
- See [testing](../TESTING.md) for current suite results.
- Migration `20261117040437_deepseek_dispatch_gate.sql` is installed in Frankfurt.
  Hosted smoke confirms the disabled gate rejects calls, clients/mock worker lack
  execute permission, and live=false, zero prices/usage and zero enabled processors.
- Private no-policy RLS tables intentionally deny direct access. No new table or
  login was created in this adapter slice. Current hosted configuration gates are
  tracked in [current status](../../CURRENT-TASK.md).

## Official references checked

- [Chat completion contract](https://api-docs.deepseek.com/api/create-chat-completion/)
- [Current models/pricing](https://api-docs.deepseek.com/quick_start/pricing/)
- [Supabase changelog](https://supabase.com/changelog.md) — CLI remains pinned to v2
  for migration creation; no CLI v3 upgrade or auth-library change in this slice.

API details/prices can change; configuration review and real provider safety/locale
evaluation remain prerequisites for activation, not claims established by mocks.

Transaction fence follow-up: regression checks reject both implicit transactions
and explicit `connection.transaction()` blocks on an autocommit connection, including
blocks opened after the gate object was constructed. No dispatch can depend on an
uncommitted reservation.

Worker integration follow-up: SAFETY-WORKER.md documents the disabled Python
consumer, processor routing, current safety review checks, cost-bound private
publication and no-replay/no-mock-fallback tests. The original evidence above is
the prior adapter milestone; current test commands report the suite results.
