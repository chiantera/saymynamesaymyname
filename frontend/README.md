# Frontend

React 19, TypeScript, Vite and a provisional Capacitor 8 configuration. `src/App.tsx`
owns data and actions; `src/Shell.tsx` renders the five-destination frame.
AuthGate isolates authenticated accounts from fictional preview. `cloud.ts` uses the publishable Supabase key with owner/generation checks
before and after requests. Secrets never belong in VITE variables.

Home offers private reflections and explicit named-recipient snapshot sharing.
Relationships offers unanimous invitations and personal membership controls.
Settings offers opt-in cloud schedules, fresh worker readiness and queue status.
The immediate preview action remains a mock; queue execution is a separate action
and is disabled when the worker heartbeat is stale. No live AI or outward messaging.

Commands from root: `npm run build`, `npm test`, `npm run test:auth`,
`npm run test:membership`. Browser suites rebuild dist and must run sequentially.
Catalog translations are drafts; Android/device/push verification remains pending.

Current mock execution: the same hosted cron now calls a bounded Postgres consumer
inside the existing Frankfurt project. It uses private static catalogs and the
existing leased queue. Render/Python remain available for later; no paid service
or external AI is needed for this interim mode.

AI consent foundation: Settings and guarded SQL persist private source preferences,
reflection exclusions and versioned provider/capability/fallback approval. Real
provider controls remain unavailable pending review. Details: docs/implementation/AI-CONSENT.md
at repository root. No mock-worker journal access or external AI activation.

Budget integration adds owner-only usage/ceiling/pause controls and a separate
restricted accounting role. Exact reservations and unresolved holds are tested with
fictional prices; live AI is disabled. See docs/implementation/AI-BUDGET.md at root.

## Visual system and verification

[DESIGN.md](DESIGN.md) defines the bottle-glass/sage/amber palette, self-hosted
variable fonts, shared primitives, responsive rail/tab shell and accessibility
contracts. Home includes a timezone-aware day band of actual check-ins; Growth and
Bartender remain clearly labeled previews. No new AI or backend capability is
activated by the redesign.

`npm run test:browser` exercises 140 destination/locale/theme/width combinations,
checks overflow at 360px and runs axe WCAG A/AA checks for the English screens.
Auth and membership suites audit additional simulated cloud states and dialogs.
Screenshots use fictional fixtures and remain in ignored `.local/screenshots/`.
See [verification](../docs/implementation/FRONTEND-OVERHAUL.md).


Crisis resources and private safety notices: see
[CRISIS-SUPPORT](../docs/implementation/CRISIS-SUPPORT.md). The static help panel
works outside authentication, selects country only on user input and hides expired
emergency numbers. Private notices store allowlisted metadata only. Topic advice
and automatic crisis responses require professional locale review; live AI stays
off. No automatic contact, location lookup or third-party widget is introduced.
