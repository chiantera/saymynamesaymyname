# Private AI consent foundation

## Current scope

Settings stores an account-private, off-by-default preference for saved reflections
as possible future AI context. Each reflection can be excluded independently; an
exclusion survives turning the category off/on. Shared copies are not original
owned reflections and do not become saved context through membership or sharing.
Documents and previous-chat inputs are represented but unavailable until their
source features exist. No provider API is invoked by this implementation.

Providers are allowlisted per capability: DeepSeek chat; Anthropic chat/OCR; Mistral
OCR; Groq transcription. They are candidates, not a claim of verified language,
pricing, safety or data-handling support. All deployed catalog rows have processing
disabled and no reviewed policy version, so their approval controls are unavailable.
No account, API key, paid service or external processor was activated.

## Approval and revocation

A later operator review must supply a versioned HTTPS policy reference and review
date. The user approves that exact provider/capability/version separately; fallback
requires its own explicit switch on the approved capability. Runtime enablement is
a separate gate. Changed review versions or policy URLs revoke grants and fallback, so reverting a
catalog revision cannot resurrect an earlier approval. Revocation is always allowed.

Saved-context category permission alone authorizes neither provider processing nor
sharing. Revision checks reject stale writes from another device. Narrow RPCs derive
owner from authenticated identity, never caller-supplied owner IDs. Every table has
RLS and no direct client grants in the non-exposed private schema.

The `eligible` action is only a metadata preview for the current user's owned
reflection IDs. It returns nothing without current beta access, journal opt-in,
matching reviewed/enabled chat capability and user approval; requested fallback
also requires fallback approval. Individual exclusions are then filtered. It returns
no text and is not a general worker context builder. The mock worker retains zero
journal access. Future AI calls must reauthorize at execution and apply source,
consent, cost, region and safety gates; this slice does not complete those paths.

Minimal consent receipts contain action/provider/source IDs and boolean/version
metadata, never reflection text, names or auth secrets. Current choices persist for
the account lifetime; superseded receipts expire after 90 days through bounded
cleanup in the existing cron command. Source deletion cascades exclusion rows.

## Evidence and limits

- 43 real PostgreSQL tests: existing membership/sharing/scheduling/worker checks plus
  consent defaults, stale revision rejection, unreviewed-provider denial, exact
  capabilities, fallback, terms change, per-item exclusion, cross-member privacy,
  runtime disable/revocation and event cleanup.
- Browser + real SQL: category/exclusion save/reload, sticky exclusions, unavailable
  provider controls and 390px layout. Auth/HTTP transport is simulated.
- Hosted `supabase/tests/ai_consent.sql`: fictional actor only, all rows rolled back.
- Seven catalogs contain 295 draft keys each; human/native review remains pending.

No real provider call, provider safety evaluation, cost reservation, attachment
processing, chat/document retrieval or Android validation is claimed. Remaining M4
work starts with provider-neutral composition and atomic budget reservations. The
free Postgres executor stays static-mock-only; Render remains a later runtime.

Supabase RLS reference checked 2026-11-16:
https://supabase.com/docs/guides/database/postgres/row-level-security


Dormant adapter integration: DEEPSEEK-ADAPTER.md now documents a server-only
fixed-input solo draft service with real SQL reservation/reporting and safety
hooks. No provider calls or activation occurred. Saved-source retrieval, evaluated
safety, reviewed live pricing/terms, invoice integration and runtime wiring remain
separate gates; the static Postgres worker never invokes this adapter.


Disabled worker integration adds current safety-policy review to provider/lease
authorization and rechecks both before private pending-draft publication. Existing
app jobs retain mock routing. No saved-source access or outward sharing is added;
consent/runtime/price/safety approvals remain separate. See SAFETY-WORKER.md.
