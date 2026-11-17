# Roadmap and implementation scope

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-6"></a>

## 6. Phased roadmap (plan-all, build-in-phases)

- **Phase 0 — Foundations**: React + Vite + TypeScript app shell with Capacitor + Supabase project, auth, solo user
  onboarding, and the ability to **create 0..N relationships** (1..N members) and
  optionally invite others. No loop yet — just users, relationships, membership.
- **Phase 1 — The AI loop, minimal**: check-in prefs (per-relationship cadence +
  quiet hours), cron dispatcher, **push + in-app** delivery, **AI compose** (provider adapter; DeepSeek primary, Anthropic fallback)
  with a context-builder + fallback library, capture responses as entries, basic
  streak. Works for both solo (growth) and relationship check-ins.
  *This is the heartbeat — get the AI prompts genuinely good first.*
- **Phase 2 — Memories + advisor**: full journal, important dates + reminder cron,
  photos. Daily digest. **Advisor chat ("bartender")** + **context upload (docs +
  image OCR)** + **Goals/personalization area (§3c)** — these enrich the AI's context.
  Introduce **bartender tools** (§11): read tools + low-risk writes (cadence,
  personalization) first, expanding later.
- **Phase 3 — More channels**: Email, then Telegram (easy two-way), then SMS &
  WhatsApp (Twilio), then Google Calendar. Add inbound reply handling per channel.
- **Phase 4 — Smarter loop**: fatigue-aware adaptive cadence, weekly recap, richer
  stats, deeper personalization, possibly AI acting more autonomously for the user.

Each phase ends with something usable — solo first, then with any relationships added.

---

<a id="section-7"></a>

## 7. Cross-cutting status (see §27 for remaining owner choices)

- **AI authenticity/consent** — *resolved*: per-check-in choice (send/edit/auto/skip),
  with per-channel default action + window as the fallback, and per-check-in override
  of both. Nothing further blocking; refine preset values during Phase 1 build.
- AI tone/voice — *resolved*: bartender persona, default nudge/listen + one-liners,
  user-tunable; text-first with optional TTS later (see §2c).
- AI usage accounting and the EUR 20 testing target are agreed (§9/§16). Provider prices/rates must be verified during setup.
- Privacy model — *resolved*: members see only **resulting content**, not each
  other's check-in activity. Check-ins, decisions, and prompt history are **per-user
  private**. **Journal entries default to private; sharing is opt-in.** A private
  entry stays unseen by other members. A relationship holds only what each chose to surface.
- Paid external channel activation waits for its feature phase and a checked cost/
  permission setup. Integration design is delegated; new spending is not implicitly approved.
- Delivery reliability strategy (retries, idempotency, timezone correctness). → §8
- Hosting is decided: Vercel + Frankfurt worker + Supabase durable state (§8/§14).

---

<a id="section-28"></a>

## 28. Phase 0/1 execution authorization

The user requested a concrete Phase 0/1 implementation plan and continuation without
another permission stop. Execute `docs/implementation/PHASE-0-1.md`, beginning with
local fictional data and mock processors. O1 branding and O5 pricing remain deferred;
O2/O3 recommended attribution/translation defaults are adopted for now. O4 actual
hosting budget and O6 actual processor data terms remain configuration/activation gates,
not blockers to local implementation. Earlier planning-only stage instructions are
superseded by this explicit user request. Record actual progress in CURRENT-TASK.md.
