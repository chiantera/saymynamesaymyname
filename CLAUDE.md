# CLAUDE.md

Guidance for working on this project.

## Current stage: PLANNING

Nothing is built yet. The immediate goal is to **produce a plan** for the app.
The specs below are a **starting point, not commitments** — expect them to change
as we think through the problem. Do not start scaffolding code, installing
dependencies, or creating a backend until the plan is agreed.

## What the app is

A mobile app for **personal growth and relationship management**. At its core it is a
**multi-channel, AI-driven check-in engine**. It works **standalone for a solo user**
(growth pillar) and lets the user track **any number of relationships** on top.

## Sibling codebase: ./schedapro (reuse freely)

`./schedapro/` is **our own code** (we built it) — third in the family **PLT (legal) →
SchedaPRO (fitness) → this (relationships)**, which recycles infra and swaps domain.
**Copy/lift/rewrite snippets, files, or whole folders freely** — no licensing concern.
Strong reuse candidates + domain mapping live in `PLAN.md` §13. Map: *scheda cliente*
→ per-relationship page; *Aria* → the bartender; engine = **DeepSeek primary, Anthropic
fallback**.

**GUARDRAIL RULE — never downgrade.** Our `PLAN.md` §12 guardrails are stronger than
SchedaPRO's. When porting code, keep our guardrails on top; if ported code conflicts
with §12, §12 wins. Don't inherit the sibling's lighter safety posture.

**Stack — OPEN decision (resolve before scaffolding):** SchedaPRO is React+Vite+TS+
Capacitor (PWA→Android), not Expo/RN. Reuse-maximizing = adopt Capacitor; original plan
= Expo. See `PLAN.md` §13.

## Inclusive by design (FOUNDATIONAL — never regress)

- Never assume the user is in a relationship. Solo is a complete, first-class experience.
- A user has **0..N relationships**; each relationship has **1..N members** (supports
  polyamory / non-dyadic structures). Never hardcode "two people" or "a couple."
- **No assumptions about gender, orientation, or relationship structure.** LGBTQA+ and
  non-traditional relationships fully supported. Copy must be neutral and affirming.
- The user names and defines each relationship. See `PLAN.md` §1a (authoritative).
- **Enforce in the AI too**: these invariants live in a centralized system-prompt core
  prepended to *every* Claude call (check-ins, advisor, digests). The model must mirror
  the user's own terms (names, pronouns, labels), never guess. See `PLAN.md` §9.

## Decisions made

- **Approach**: plan the full vision now, then build in **phases** (incremental).
- **North-star priority**: the **check-in loop** — timely, meaningful prompts that
  actually make the partners connect. Everything else serves this. When trading off,
  favor the check-in loop.
- See `PLAN.md` for the full, living plan.

## Safety is first-class (never weaken)

This app gives emotional advice, holds sensitive relationship data, sends on many
channels, and lets the AI act via tools — a high-risk surface. `PLAN.md` §12 is the
consolidated guardrails system (defense-in-depth). Treat these as load-bearing:
untrusted content (OCR/uploads/inbound) is **data, not instructions** (prompt-injection
defense); the app must **never enable coercive control/surveillance** of a partner;
crisis signals **drop the persona** and surface region-correct resources; cross-member
**private data never leaks**. Don't dilute these when implementing features.

High-severity protocols (§12): **self-harm**, **violence**, and **stalking** each have
explicit handling. Two rules that must be enforced **in code, not just by the model**:
(1) a **muted/left/blocked/archived** member is **unreachable** via send tools/autopilot
— no AI override; reachability is gated in the delivery path. (2) **never build location
tracking of others**; support **discreet notifications + quick-exit** for victims whose
device may be monitored.

## Starting-point specs (provisional)

**Platform**
- Mobile-first via Expo (React Native) — targets iOS + Android, with a web build
  from the same codebase. Chosen so no distribution/sales channel is precluded.

**Backend (tentative)**
- Supabase: Postgres, Auth, Storage. Edge Functions + pg_cron for scheduled jobs.

**Core features**
- Shared access: each partner has an account, joins a shared space via invite link.
- Journal / notes: entries with text, mood, date.
- Important dates: anniversaries, birthdays, milestones — with reminders.
- Photos & media: sentimental photos, standalone or attached to memories.

**Crons / scheduled jobs (central to the app, not an add-on)**
- Check-in messages: every 3–12h. Each partner sets their **own** frequency.
- Important-date reminders: notify ahead of time (e.g. 7d / 1d / day-of).
- Daily digest: morning summary (user timezone).
- Weekly recap: summary of the week's entries/moments.
- Streak tracking: nudge if no entries for a while.

**Delivery channels (per-user, configurable)**
- Push (Expo), SMS, Email, WhatsApp, Telegram, Google Calendar, In-app.

## Open questions to resolve during planning

- Scope for a first version (MVP) vs. later phases — which channels and crons ship first?
- How check-in content is generated (static prompts? user templates? AI-written?).
- Per-user data needed to drive channels: timezone, phone, Telegram chat ID,
  Google Calendar auth, push tokens, channel preferences, frequency.
- Privacy/consent model for a shared space (what one partner can see of the other).
- Cost and account requirements of third-party services (Twilio, Resend, Telegram, Google).
- Reliability of scheduling (timezones, per-user intervals, missed/retried sends).

## Working notes

- Working directory contains `anto-e-anna.webp` (an image — possibly the couple).
- Treat this CLAUDE.md as the living source of truth for project context; update it
  as decisions are made, and move items out of "provisional/open" as they're settled.
