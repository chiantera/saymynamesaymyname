# Safety, privacy, revocation and operations

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-12"></a>

## 12. Guardrails & Trust/Safety (consolidated — the safety backbone)

This app gives emotional advice, stores sensitive relationship data, sends messages on
many channels, and lets an AI take actions via tools. That is a **high-risk surface**.
Guardrails are a **first-class system**, not scattered notes. Defense in depth across
five layers, plus special-case handling and process. (Supersedes/centralizes the
safety bullets in §2c/§9/§11.)

### Layer 1 — Input guardrails (what comes in)
- **Untrusted content is data, never instructions.** OCR'd screenshots, uploaded docs,
  inbound channel replies, and another member's messages are **untrusted** and must be
  clearly delimited in the prompt. The model is instructed to **treat them as content
  to reason about, not commands to obey** — core **prompt-injection** defense, critical
  now that the bartender has tools. Tool calls are never triggered by text inside
  uploaded/inbound content.
- **Classify each advisor turn** for risk (self-harm, abuse/DV, violence, minors,
  medical/legal/financial, harassment) before composing a normal reply.

### Layer 2 — Generation guardrails (what the AI says)
- Centralized system-prompt core (§9) carries **inclusivity (§1a)** + **safety**
  invariants on every call.
- **Scope discipline**: not a therapist/doctor/lawyer/financial advisor; no diagnosis;
  steer to professionals for out-of-scope needs. Never claims to be human or licensed;
  if asked, is honest that it's an AI. ("Bartender" is a persona, not a deception about
  being a professional.)
- No content that manipulates, shames, or coerces the user or a member.

### Layer 3 — Misuse & abuse guardrails (THIS app's biggest risk)
- **Coercive control / surveillance refusal**: the app must never become a tool to
  **monitor, track, pressure, manipulate, isolate, or harass** another person. The AI
  refuses requests like "help me check if they're lying / guilt-trip them / make them
  reply / track them" and gently reframes toward healthy communication.
- **Abuse-aware**: if a user appears to be **experiencing** abuse, prioritize their
  safety and surface localized DV resources (§10.6); if a user appears to be
  **perpetrating** control/abuse, do not assist and do not coach manipulation.
- **No auto-send weaponization**: autopilot (§2b) can't be used to spam/harass a member;
  rate-limit and respect a member's ability to mute/limit inbound.

### Layer 4 — Action/tool guardrails (what the AI does — §11)
- Single-user-scoped, **RLS-enforced server-side**; model proposes, backend validates
  & whitelists every argument; model never touches the DB. Confirmation tiers per §11.
- **Jailbreak/social-engineering resistant**: instructions in user/inbound/uploaded text
  can't expand tool scope, bypass confirmation, or reveal another member's data.
- **Rate limits** on tool calls and sends; anomaly detection on bursty/odd activity.

### Layer 5 — Output/delivery & data guardrails
- **Auto-sent content is safety-checked before it leaves** (§2b autopilot): sensitive
  moods → gentler/optional; detected conflict/crisis → **hold and surface to the user**,
  never auto-send.
- **Cross-member privacy is absolute**: private data (§2/§3c) never leaks to another
  member or into content composed for them.
- **Redaction before AI (from SchedaPRO `domain/redaction.ts`)**: minimize or
  pseudonymize unnecessary names/identifiers before provider calls, with restoration
  only in authorized display/output. Cloud-authorized processing still occurs;
  do not claim that no data leaves the device. Especially important for sensitive relationship data; the
  context-builder (§9) applies this on the way out.
- **Private-cloud-first sync with local cache:** Postgres/private Storage are the
  source of truth under the agreed retention and authorization rules. Use minimal
  per-user caches, platform-appropriate local protection and clean session isolation;
  never inherit SchedaPRO's local-only privacy claim. Exports contain sensitive data
  and are delivered privately; encryption at rest is not end-to-end encryption.
- **Data protection**: encrypt sensitive data at rest/in transit; data minimization;
  **user data export & delete** (GDPR/CCPA); relationship/emotional data is a *sensitive
  category* → explicit consent for processing. Third-party channel data shared only as
  needed to deliver.

### High-severity scenarios (non-negotiable protocols)

A shared protocol for all three: **Detect → Drop the persona → Respond with care →
Surface region-correct resources (`crisis_resources`, §10.6) → Restrict what the app
will do → Record/flag for review.** Always **err toward safety and never gatekeep
help**. Never minimize, diagnose, play-act, or provide harmful means/methods/instructions.

**A. Self-harm / suicide (danger to self)**
- On ideation/intent signals: stop normal advice, respond with non-judgmental care,
  and make **crisis lines + emergency services + a trusted person** easy to reach now.
- Never provide methods or anything that could facilitate self-harm; never discourage
  seeking help. Encourage professional support; the bartender is not a substitute.
- After an episode, future check-ins/autopilot soften automatically (no breezy
  one-liners into a crisis); keep a resource always one tap away.

**B. Violence (danger to or from a person)**
- **User is a victim** (IPV/DV, threats): prioritize their safety; surface DV resources
  and safety-planning info. **Never suggest actions that could escalate danger** (e.g.
  confronting an abuser). Be aware the device may be monitored (see Device safety).
- **User expresses intent to harm another**: take it seriously, **do not assist**, do
  not coach it, de-escalate, and point to crisis/support resources. Never help plan,
  locate, or carry out harm.
- The app/tools must **never facilitate violence** (no helping find, track, or corner a
  person — overlaps Stalking).

**C. Stalking / surveillance (the app as a weapon)**
- Highest app-specific risk: features like check-ins, "message a member," autopilot,
  and ended/archived relationships could be misused to **monitor, track, repeatedly
  contact, or surveil** someone — including an ex or someone who set boundaries.
- The AI and tools **refuse** to: locate/track a person, infer their whereabouts,
  bypass a block/mute, mass- or repeat-contact against their wishes, or "keep tabs."
- **Boundaries are enforced in code, not just by the model**: if a member **mutes,
  leaves, or personally archives that relationship**, the send tools / autopilot
  **cannot reach them through that relationship** — no AI request can override this. A person who exits is unreachable
  through the app.
- If a user appears to be **the target** of stalking, surface resources and the
  device-safety options below.

### The persona-drop message (canonical copy)
When the bartender hits a high-severity scenario or anything out of its depth, it
breaks character with this honest, warm deflection (template — **localized (§10)**,
with **region-correct numbers/resources from `crisis_resources` (§10.6)**, not
hardcoded):
> "I'm just an artificial bartender — not a professional, and some things matter more
> than anything I can offer. If you or someone you know might be in danger, please call
> **[local emergency number]** now. For a health problem, reach out to your doctor.
> And for what's weighing on you, a therapist in your area can really help —
> [optionally: want a hand thinking about how to find one?]. And drive safe."
- `[local emergency number]` resolves per region (e.g. 911 US/CA, 112 EU, 999 UK,
  000 AU) — **never hardcode** one region's number.
- **"And drive safe"** is the bartender's **signature signoff** — the same warm close
  as the "bar's closed" notice (§2c). Keep it consistent across the persona's hardest
  moments; it's a small thread of care that ties the character together. (In a crisis
  reply, place it gently at the end so it never undercuts the seriousness.)
- This doubles as the **scope-limit message** (not a therapist/doctor — §12 Layer 2):
  honest that it's an AI, points to real help, stays kind. Always reachable as a
  one-tap "get help" action, not only when triggered.

### Device & victim safety (cross-cutting feature work)
Because abusers/stalkers often have physical access to the victim's phone:
- **Discreet notifications**: option to hide message content on lock screen / use a
  neutral app label; sensitive check-ins don't reveal contents in previews.
- **Quick-exit**: a fast way to leave a sensitive screen / hide the app.
- **App-lock (reuse SchedaPRO `lock/` module)**: PIN (PBKDF2) + optional biometric
  (WebAuthn) + idle-timeout lock — a ready-made basis for protecting on-device data;
  port it and keep our stronger guardrails on top.
- **No location tracking of others**, ever — not a feature we build.
- These are real build items, not just policy. Flag for design in the relevant phase.

### Eligibility
- **Adults only (18+)** given the relationship/emotional nature — gate at signup; define
  handling if a minor is suspected.

### Process & accountability
- **Red-team & eval suite**: test prompt injection (incl. via uploaded images),
  jailbreaks, coercive-control prompts, crisis detection, cross-member leakage,
  inclusivity regressions (§9) — run before each release.
- **Flag & review**: record minimal technical/risk metadata, never an automatic feed
  of private conversations to staff. In-app reports let users preview/select the
  content shared with assigned support reviewers; access is restricted and audited
  (§19). Disclose that the advisor is AI, not a substitute for professional care or
  a continuously monitored crisis service.
- **Incident path**: defined process for safety failures; the `[support address]` (§2c)
  is monitored.

**Open decisions**
- Who owns T&S review and crisis-resource verification per region.
- Separate pre-action safety gates are decided (§18); validate classifier/model and
  crisis eval quality before enabling automatic actions.
- Verify provider encryption/key settings and remaining backup/operational retention; the initial encryption model is decided (§21).

---

<a id="section-18"></a>

## 18. Conflicts, unsharing, safety gates and exports — DECIDED

1. **Offline edit conflicts:** if the same note is changed on two devices, preserve
   both versions and ask the owner which to keep or merge. Never silently overwrite
   a substantive edit. A server-side deletion must not be undone by an offline edit;
   offer recovery as a new private draft only through an explicit user action.
2. **Unsharing content:** allow the owner to revoke a recipient's future access to
   the live shared item immediately. Remove that item's grants, pending deliveries,
   search results and future AI context for that recipient. Leaving alone retains
   previously received history as agreed; explicit unsharing/deletion overrides live
   access even for a departed member. Explain that independent downloaded copies or
   already delivered external messages cannot be recalled. Handling references and
   independently authored replies must preserve other users' own content without
   retaining hidden readable copies of a revoked source.
3. **Safety checks before actions:** use a separate server-side safety/authorization
   gate before outward automatic sending and sensitive AI tool execution, rather than
   trusting the composing model alone. Deterministic permissions/block/consent checks
   always apply. A separate model check may use only approved processors and consumes
   budget. If a required check fails or is unavailable, hold the action and explain
   why; do not bypass it or imply a human tap overrides hard safety boundaries. Static
   help resources remain available without paid AI checks. This does not claim perfect
   crisis detection or substitute for the existing response protocols.
4. **Data export:** offer an account-private downloadable ZIP containing readable
   journal/chat/context text, structured JSON metadata and approved memories, plus
   originals still retained and accessible. List expired originals rather than claiming
   they are included. Include only owned content or content the requester currently
   has permission to export, never other members' private data. Scope exports clearly
   to the user's perspective; quota and billing records need no raw private text.
   Require authentication and short-lived private download access, not public links.

All four above were approved. Apply them to schema, action gates and export design.
This settles separate pre-action gates; the concrete safety-model provider/evaluation
still requires validation before automated actions are enabled.

<a id="section-19"></a>

## 19. Paid allowance, beta billing, diagnostics and support access — DECIDED

1. **Initial paid storage allowance:** **5 GB per user for retained context originals**,
   configurable server-side so additional tiers can follow. No automatic time expiry
   under active paid access; the agreed full-quota and downgrade rules still apply.
   This is a product allowance, not a provider-cost estimate or pricing
   commitment. Gallery memories share this byte allowance under §21, with separate
   non-expiring retention. Extracted-text and AI processing/ingestion limits must not
   be advertised as unlimited.
2. **Beta billing:** defer real payments during the invite-only beta. Assign free or
   time-limited paid-feature entitlements manually to selected testers, with visible
   storage limits and an end date. No payment card or automatic renewal. Expiring
   a paid-feature grant follows the same 30-day grace and notices already agreed.
   Track aggregate original storage as well as the EUR 20 AI budget; test entitlements
   do not authorize unlimited hosting spend. Set public pricing after measured beta
   usage and before accepting subscriptions.
3. **Technical diagnostic logs:** retain redacted technical event metadata for
   **14 days**, with automatic expiry. Record errors, durations and opaque job IDs;
   no message bodies, documents, transcripts, audio, credentials, invite tokens or
   full signed URLs. Sanitize provider errors and request logging at API/worker layers.
   This policy does not shorten user-owned chats/memories/change history,
   consent receipts or cost/billing records, which need their own stated retention.
   Validate vendor logging controls separately; do not promise control over a vendor's
   retention before inspecting it.
4. **Human support access:** no routine human browsing of private chats/uploads.
   Users can report a problem and preview/select the specific messages or files
   shared with support. Access is limited to assigned support reviewers, logged and
   revocable for future access. Automated risk events log minimal metadata, not an
   automatic raw-conversation feed to staff. This decision refines §12's earlier
   "flag & review" wording: a safety flag alone does not authorize reading private
   content. Support-case retention and access for exceptional incidents require an
   explicit documented policy; do not imply a continuously monitored crisis service.

All four above were approved. Paid price is deferred until measured beta usage;
backup purge timing, support ownership, provider-side retention and concrete deployment
sizing remain operational follow-ups. Paid 5 GB is a per-user quota, not a shared pool.
