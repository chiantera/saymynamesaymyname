# Frontend overhaul: integration and verification

## Scope

Completes the interrupted `frontend-overhaul` workflow against
[DESIGN.md](../../frontend/DESIGN.md). Its foundation and screen implementations
were recovered from the working tree; 39 translation drafts were recovered from
local agent results. Existing catalog meanings were preserved, missing drafts
completed and section labels added in all seven locales. Catalog keys are checked from the files. All translations remain drafts pending human/native safety review.

No backend runtime, Supabase migration, provider review, live activation switch,
price row, worker mode or billing setting is changed. Live AI stays disabled.
Growth and Bartender remain explicitly planned screens, not functioning AI tools.

## Structure and behavior

- App owns polling, actions, check-in decisions and version guards; Shell owns the
  rail/header/tabs and the single account control. AuthGate still isolates accounts
  and fictional preview through keyed remounts and guarded cloud access.
- Shared primitives wire labels, hints, disabled states and native modal dialogs.
  Leave/block/share retain explicit confirmations. Recipient grants, unanimity,
  membership generations, pairwise block rules and revocation stay server-side.
- Source text remains ordinary React text; no untrusted HTML is introduced.
- Self-hosted Latin/Latin-ext variable fonts have system CJK fallbacks. Tokens own
  both themes; reduced motion and keyboard focus are retained. Manual theme also
  updates the browser theme color. Signed-in narrow headers preserve control space.
- The Home day band is a local wall-clock summary of actual records, quiet hours
  and snoozes. It does not promise future delivery or invent scheduled events.
  Repeated DST-hour records can overlap. Pure tests cover clock parsing, local-day
  boundaries, overnight quiet hours, next-day snooze and repeated DST hours.

## Checks

Run browser suites sequentially; auth and membership rebuild frontend/dist.
All test data is fictional and isolated. SQL fixtures reject hosted DSNs and
create/drop only their own generated loopback databases.

| Command | Coverage |
| --- | --- |
| `npm run check` | frontend tests, local backend tests, seven catalogs, source-key/interpolation checks, TypeScript/Vite build |
| `npm run test:database` | PostgreSQL tests: membership, grants/revocation, leases/scheduling, consent and budgets |
| `npm run test:browser` | Compose/edit/save/skip/snooze, persistence, 140 combinations of five destinations × seven locales × two themes × two widths |
| `npm run test:auth` | Simulated signup, recovery/PKCE/error states, beta admission, private sync, account isolation, Google request |
| `npm run test:membership` | Production client with real local SQL/RLS: unanimous joins, pairwise blocks, explicit sharing/revocation, budget/consent and mock queue |

Preview tests assert no horizontal overflow at 360/1440px and no third-party asset
requests during the matrix. Axe WCAG 2 A/AA and 2.1 AA checks cover all English
destinations in both layouts/themes. Additional audits cover auth states, cloud
membership, the sharing modal and private settings in light/dark. This is automated
coverage, not certification or a replacement for assistive-technology testing.

Ignored screenshots live under `.local/screenshots/`: `overhaul-*` covers English,
German and Korean in both themes/layouts; existing membership/sharing/auth fixtures
provide cloud-state evidence. No real private content is published as screenshots.

The locale checker now parses literal and conditional translation calls and section
label keys, checks interpolation names and registers dynamic families. New dynamic
families must extend the registry. Catalog parity alone is no longer sufficient.

## Remaining release gates

Native-speaker review, professionally verified safety copy, assistive-technology
review and real Android/device/push tests remain pending. Provider composition,
reviewed terms/prices, execution-time safety/source authorization and billing
integration are independent Phase 0/1 work; the visual overhaul does not complete
them. No paid hosting or live AI activation is part of this milestone.

## Local result — 2026-11-17

All commands above passed. The expanded cloud audit detected provider list items
whose `role=group` replaced their list semantics; grouping was moved inside each
list item and the SQL-backed browser test passed again, including dark settings.
Automated preview checks passed all 140 combinations and 20 English destination
audits. Auth state audits passed. Dependencies report zero npm audit findings at
installation; this is a point-in-time report, not a security guarantee.

CI now also runs the expanded preview browser suite before auth and membership.
The branch was first published separately for review/preview. On 2026-11-17 it
was fast-forward merged into main and deployed to production at the owner’s request.

CI follow-up: Linux axe initially sampled navigation colors during a theme
transition. The shared fixture audit now awaits document font readiness and
actual CSS animation completion before measuring contrast. No accessibility rule
is disabled, no fixed sleep is used and no product behavior is changed.

Production follow-up: the repeated Linux cloud fixture sampled scroll width directly
after resizing, before React switched from the desktop rail to mobile tabs. The
fixture now waits for the actual mobile shell before checking overflow. This keeps
the width assertion and product behavior intact; repeat CI verifies the correction.
