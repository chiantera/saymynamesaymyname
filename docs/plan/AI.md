# AI providers, context and accounting

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-9"></a>

## 9. AI usage & cost architecture (the brain)

The AI runs on **every** check-in and every advisor turn, so design for **quality,
latency, and cost** from the start. Default routing is **DeepSeek primary,
Anthropic fallback**, through the provider-abstraction layer and approved-provider
consent gates (§9a).

### 9a. Provider abstraction (no vendor lock-in — DECIDED)

All model access goes through **one internal interface**, never a direct SDK call from
feature code. Adapters implement it per provider (DeepSeek, Anthropic, OpenAI, Google,
open/self-hosted models, etc.).

- **Normalized capabilities**: chat/completion, **tool use**, **vision** (for OCR/
  screenshots, §10.5), streaming. The adapter maps our canonical request to each
  provider's format — *tool-calling and message schemas differ across vendors*, so the
  abstraction must normalize them.
- **Config-driven routing**: pick provider/model per task (cheap/fast for routine
  check-ins, stronger for advisor) and per region/compliance need — swappable without
  touching feature code.
- **Default routing (from the SchedaPRO sibling, proven)**: **DeepSeek primary** (cheap
  "Flash" tier for routine, high-volume check-in composition → answers our cost worry),
  **Anthropic fallback** and for the nuanced advisor / sensitive turns (a "Pro" tier).
  The cheap/strong split mirrors SchedaPRO's Flash/Pro policy; the stronger tier gates
  on the same explicit-confirmation stance as our consent model (§2/§11).
- **Failover (ties to reliability below)**: on a provider error/timeout, route only
  to another capable **user-approved provider** when automatic fallback is enabled.
  Otherwise use the static "bar's closed" / fallback-library path (§2c/§2b). An
  available but unapproved provider is not a fallback option. Approval does not waive
  item exclusions, category consent, task permissions or regional restrictions.
- **Guardrails are provider-agnostic**: the centralized system-prompt core +
  inclusivity/safety invariants (§9, §12) apply to **every** adapter; the eval/red-team
  suite (§12) runs **per provider** so swapping a model can't silently weaken safety.
- **Separate adapters** for OCR/vision, **speech-to-text (voice input)** and TTS
  (voice output), as well as chat models. Cloud processors each require provider
  approval for the relevant capability; do not treat chat approval as transcription
  or voice-output approval. Cloud voice output is separate from native device speech.
- **Voice input:** start by evaluating/reusing SchedaPRO's **Groq transcription**
  integration behind the speech-to-text adapter. Groq is the initial candidate based
  on the user's testing experience, not a promise of permanent free service. Verify
  current pricing, quotas, data handling and supported language/model capabilities
  before enabling it. Test all seven launch languages, especially Cantonese separately
  from Mandarin. Do not silently translate a transcript into another language.
  Microphone permission and processor consent are separate. Show/edit the transcript
  before sending it to chat or saving as context. Keep provider keys server-side.
  If no approved capable transcription provider is available, allow typed/pasted input;
  do not route audio to an unapproved provider. Discard recordings after successful
  transcription by default; per-recording keep-original follows storage-tier rules (§14).
- Watch per-provider differences in prompt-caching, token limits, and pricing in the
  cost controls below.

**Context-builder** (one place, reused by check-ins + advisor)
- Assembles a compact, **privacy-filtered** context slice per call: profile + goals
  (respecting shared/private), recent moods/entries the user owns or that are shared,
  upcoming dates, recent check-in outcomes, and relevant uploaded context sources.
- **Saved-context consent (§14):** journal entries, extracted documents and prior
  chats require their respective opt-in switch, plus per-item eligibility. Ownership
  or a sharing grant alone does not authorize saved-context retrieval. With switches
  off, use only the current conversation and material explicitly attached for the
  current task. Enforce permissions before retrieval, summarization and provider calls.
- Hard token budget; summarize/trim oldest eligible material rather than dumping everything.

**Cost & latency controls**
- **Prompt caching** for the stable system prompt + persona + slowly-changing profile
  → big savings since these repeat across calls.
- **Right-size models** through capability-tested provider configuration; choose a
  routine and a stronger tier only after current cost/capability/safety checks. Never
  silently move sensitive context to an unapproved provider to obtain a stronger model.
- **Don't call when not needed**: skip composition for users in quiet hours or with no
  open slot; reuse a recent generation if context hasn't changed.
- Batch non-urgent generation (e.g. digests) where latency doesn't matter.

**Reliability (failover, then two fallback modes)**
- **First, approved-provider failover** (§9a): retry only when automatic fallback
  is enabled and another approved, capable provider is available. Otherwise enter
  the appropriate static mode below; never exhaust unapproved providers first.
- **Check-in heartbeat**: backed by the **fallback prompt library** (§2b) — pre-written,
  localized nudges so scheduled check-ins keep firing even when every provider is down.
  Timeouts → failover → fallback, log, move on.
- **Interactive advisor**: a conversation *can't* be faked from static text, so when all
  providers fail it shows the static, localized **"bar's closed" notice** (§2c) instead
  of a reply — break character gracefully, never stall or hallucinate offline.

**Safety & inclusivity (baked into every prompt)**
- One **centralized system-prompt core** is prepended to **every** AI call — check-in
  composition, advisor chat, digests, recaps — so these rules are defined once and
  inherited everywhere (no prompt can opt out):
  - **Inclusivity invariants (§1a)**: never assume the user is in a relationship,
    never assume number of members, never assume gender / orientation / relationship
    structure. Use neutral, affirming language; mirror the user's own terms (names,
    labels, pronouns) rather than guessing. Affirm LGBTQA+ and non-dyadic relationships.
  - **Safety guardrails (§2c)**: bartender persona; not a therapist and never claims
    to be; crisis/abuse/self-harm → drop the act, respond responsibly, surface real
    help; no clinical diagnosis.
- The context-builder supplies the *facts* (who the members are, pronouns, labels) so
  the model personalizes from real data instead of assumptions.
- Add this to an eval/checklist: prompts should be tested against solo users, same-sex
  relationships, polyamorous structures, and no-relationship states to confirm the
  output never regresses to heteronormative or couple-centric defaults.

---

<a id="section-16"></a>

## 16. Usage accounting and the EUR 20 AI test budget

**One accounting path for all processors**
- Route chat, check-in generation, summaries, safety-model calls, OCR, STT and cloud
  TTS through the shared adapters. Every attempt, retry, tool-loop step and fallback
  is a separately tracked potential charge, linked to its logical task.
- Store **usage_events**: task/attempt IDs, provider request ID, model/capability,
  timestamp, account/project attribution, tokens by billing category, audio duration,
  pages/characters where applicable, pricing version/currency, estimated charge,
  reported/reconciled charge and reconciliation status. No raw chat, documents or
  recordings in cost logs. Deduplicate receipts/webhooks, not legitimately distinct
  retry charges. Groq testing usage is still tracked even when confirmed free.
- Store a versioned **provider_price_catalog** and **budget_reservations** in Postgres.
  Prices, cached-token rates, free credits and minimum billing increments must be
  verified against the selected model/account. Never treat a missing price or missing
  usage receipt as zero cost. Use bounded output/context/audio/page limits so a
  pre-call reservation is meaningful.
- **Reserve → execute → settle:** atomically reserve a conservative maximum estimate
  before dispatch. Refuse new discretionary work when posted estimates plus pending
  reservations would exceed the remaining budget. Settle using response usage and
  reconcile against provider usage/billing exports or APIs where available. Unknown
  timeout charges remain pending estimates until resolved; do not immediately free
  their budget and launch an unbounded retry. Apply the same process to fallbacks.
- Use dedicated app credentials/projects where supported to separate PLT/SchedaPRO
  spend. Provider account totals can contain unrelated usage; reconcile the app's
  events before treating a balance change as its spend. USD-priced providers require
  recorded EUR conversion assumptions and a buffer, not a claim of exact live FX.

**Small admin cost view, not manual spreadsheets**
- Show month-to-date estimated/reconciled AI cost, pending reservations, remaining
  budget, provider breakdown and top-cost task types; include last reconciliation
  time and unknown/unpriced usage. Separate hosting/storage invoices from the AI meter.
- Proposed alert thresholds: 50%, 80%, 95%; stop new discretionary calls before the
  EUR 20 target after reservations/buffer. Keep static check-ins, help resources and
  read/export/delete available. No silent billing increase, provider change or hidden
  model downgrade to continue beyond budget.
- Configure provider-native spend limits/prepaid controls where available as a second
  layer, with auto-top-up disabled for the beta where supported. Vercel Spend Management
  governs Vercel metered usage, not direct DeepSeek/Groq/Anthropic invoices; a Vercel
  budget alone does not cap those APIs. Platform limits/usage reports can lag, so this
  is conservative enforcement, not a guaranteed aggregate invoice hard cap.
- Application budget target is agreed; exact currency rounding, safety buffer, provider
  allocations, rate limits and alert destinations remain implementation details to
  validate before paid calls. Default to pausing calls with unknown cost rather than
  silently allowing unmetered spend.

Sources checked 2026-11-14:
- https://vercel.com/docs/services
- https://vercel.com/docs/functions/configuring-functions/region
- https://vercel.com/docs/spend-management
- https://api-docs.deepseek.com/api/create-chat-completion/
- https://console.groq.com/docs/spend-limits

**Hybrid architecture decision recorded:** Vercel + Frankfurt processing worker
(PLT Render pattern), with durable Supabase job state. No provisioning or deployment
has been performed. Worker sizing and credentials are implementation setup choices;
paid capacity/pricing remain later product decisions.
