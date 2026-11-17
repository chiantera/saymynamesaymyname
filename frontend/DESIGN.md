# Design reference: "the day's rhythm, after hours"

Bottle-glass green, lamp amber, cool paper. Hierarchy comes from spacing, type and
hairlines, not from cards. Read this before touching a screen.

## Files and ownership

| File | Holds |
| --- | --- |
| `src/styles/fonts.css` | Self-hosted `@font-face` (latin, latin-ext). No third-party requests. |
| `src/styles/tokens.css` | Every colour, type, space, radius, layout and motion token. |
| `src/styles/base.css` | Reset, element typography, focus ring, native controls, reduced motion. |
| `src/styles/components.css` | Primitive styles and shared layout helpers. |
| `src/styles/shell.css` | Rail, header, tab bar, mode notice, content column. |
| `src/styles/<screen>.css` | One per screen group: `home`, `sharing`, `relationships`, `settings`, `ai-settings`, `auth`, `placeholders`. |
| `src/ui.tsx` | Presentation primitives. |
| `src/Shell.tsx` | Application frame. |
| `src/App.tsx` | Data, polling, `perform`, language, theme, routing. No markup beyond composition. |
| `src/screens/*.tsx` | Home, LocalRelationships, SettingsScreen, Growth, Bartender. |

A screen agent edits only its own component file(s) and its own CSS file. Do not edit
`tokens.css`, `base.css`, `shell.css`, `ui.tsx`, `Shell.tsx` or `App.tsx`; if a primitive is
missing something, compose around it in your screen file and report it.

## Colour tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#eef1ec` | `#0f1a17` | Page background |
| `--surface` | `#fafbf8` | `#172521` | Raised surfaces, controls |
| `--ink` | `#16241f` | `#e9eee7` | Text |
| `--muted` | `#55635c` | `#9fb0a6` | Secondary text |
| `--line` | `#d3dad3` | `#2a3b35` | Hairlines, decorative borders |
| `--line-strong` | `#74837a` | `#6f857a` | Control borders (3:1 non-text contrast) |
| `--action` | `#1d5b49` | `#7fd1b0` | Primary actions, selected nav, links |
| `--action-ink` | `#f4f8f3` | `#0c1f19` | Text on `--action` |
| `--action-hover` | `#17493b` | `#9bdcc1` | Hover fill of primary buttons |
| `--lamp` | `#e9a93c` | `#f0b95a` | The one highlight: now, pending, attention. Marks only |
| `--lamp-wash` | `#f6e7c9` | `#3e402b` | Tinted fill behind lamp text |
| `--lamp-ink` | `#6b4a08` | `#f6d9a0` | Text on `--lamp-wash` |
| `--danger` | `#a8432f` | `#f08e78` | Destructive actions, errors |
| `--danger-ink` | `#ffffff` | `#0f1a17` | Text on `--danger` |
| `--danger-wash` | `#f2e9e4` | `#35342d` | Error notice fill |
| `--wash` | `#e2e9e1` | `#1e302a` | Quiet fills: selected rows, quiet-hours shading |
| `--backdrop`, `--float-shadow` | | | Dialog backdrop; the single elevation |

Contrast (WCAG AA, measured): every text token on `--paper`, `--surface` and `--wash` is
at least 5:1 in both themes; `--lamp-ink` on `--lamp-wash` is 6.6:1 light and 7.8:1 dark.
`--lamp` itself is never text and never a background for text (it fails as either in one
theme). `--line` is decorative only; anything a person must find uses `--line-strong`.

Theme: `html[data-theme]` is `system`, `light` or `dark`. Explicit wins, otherwise
`prefers-color-scheme`. The dark values exist twice in `tokens.css`; never hard-code a
colour in a screen file, and never write a `prefers-color-scheme` query of your own.

## Type

- Display: `var(--font-display)` Bricolage Grotesque Variable, weight `var(--weight-display)`
  (650; 600 for ko, zh-Hans, yue-Hant), tracking `var(--tracking-display)` (-0.02em; 0 for CJK).
- Text: `var(--font-text)` Atkinson Hyperlegible Next Variable. CJK falls back to `--font-cjk`.
- Scale: `--text-xs` 0.8125, `--text-sm` 0.9375, `--text-md` 1, `--text-lg` 1.1875,
  `--text-xl` 1.5, `--text-2xl` up to 2 (fluid), `--text-3xl` up to 2.75 (fluid), in rem.
- `h1` is `--text-3xl`, `h2` `--text-xl`, `h3` `--text-lg`, `h4` `--text-md`. Body line
  height 1.6, display 1.08 to 1.2. Paragraphs are capped at `--measure` (68ch).
- Sentence case. No all-caps, no tracked-out eyebrows, no monospace data labels. Numbers
  use `font-variant-numeric: tabular-nums`.
- The only text below the scale is the mobile tab label (documented in `shell.css`).

## Space, shape, motion

- Space: `--space-1` 4px, `-2` 8, `-3` 12, `-4` 16, `-5` 20, `-6` 24, `-8` 32, `-10` 40,
  `-12` 48, `-16` 64. Use tokens, not raw lengths.
- Radius: `--radius-control` 6px, `--radius-surface` 14px, `--radius-pill` for chips only.
- Elevation: `--float-shadow`, only on dialogs, the mobile tab bar and toasts.
- Controls are at least `--control-height` (44px).
- Motion: `--motion-fast` 120ms, `--motion-base` 180ms, `--ease`. Only in response to an
  action. No entrance animations. `base.css` disables all motion under reduced motion.
- Logical properties only: `margin-inline`, `padding-block`, `inset-inline`, `inline-size`,
  `text-align: start`. No `left`/`right`.

## Layout

- 720px and wider: sticky left rail (`--rail-width`) with brand, five destinations and a
  footer (mode notice, account control, language). Narrower: header (brand, language,
  account control), mode notice at the top of the content, fixed bottom tab bar.
  `Shell.tsx` mounts exactly one layout, so each control exists once.
- Content: every direct child of `.shell-content` is capped at `--content-width` (46rem).
  A screen that earns a secondary column uses `.page.page--split` with `.page__header`,
  `.page__main` and `.page__aside`; the aside (`--secondary-width`) sits beside the main
  column from 1100px and below it otherwise.
- Helpers (in `components.css`): `.page`, `.page__header`, `.page__lead`, `.stack`,
  `.stack--tight`, `.cluster` (wrapping row), `.rows` (hairline-separated children),
  `.fact` / `.fact__label` / `.fact__value`, `.muted`, `.text-sm`, `.sr-only`.
- No horizontal overflow at 360px in any of the seven languages. Grid and flex children
  need `min-inline-size: 0`; long names need `overflow-wrap: anywhere`. Korean uses
  `word-break: keep-all` globally.

## Primitives (`src/ui.tsx`)

| Primitive | Props | Notes |
| --- | --- | --- |
| `Button` | `variant?: 'primary' \| 'quiet' \| 'danger'` (quiet), `size?: 'md' \| 'sm'`, `icon?: LucideIcon`, `block?`, plus button attributes | `type` defaults to `"button"`. Pass `type="submit"` in forms. One primary per view. |
| `Field` | `label: string`, `hideLabel?`, `hint?`, `error?`, `className?`, one control as child | Label is linked by `htmlFor`; its text is the exact accessible name. Hint and error use `aria-describedby`. |
| `Check` | `label: ReactNode`, `hint?`, plus input attributes (`checked`, `onChange`, `disabled`) | Hint is outside the label so the name stays exact. |
| `Section` | `title`, `level?: 2 \| 3`, `ariaLabel?`, `description?`, `actions?`, `raised?`, `className?` | `ariaLabel` makes it a named region. `raised` draws the one surface a screen may need. |
| `Chip` | `tone?: 'neutral' \| 'action' \| 'lamp' \| 'danger'`, `icon?` | Status only, never clickable. Lamp means now, pending or attention. |
| `Notice` | `tone?: 'info' \| 'warning' \| 'error'`, `role?: 'status' \| 'alert'`, `icon?`, `actions?` | The caller chooses the role; omit it for static text. |
| `EmptyState` | `icon?`, `action?`, children (the sentence) | Invite the next action. |
| `ConfirmDialog` | `open`, `title`, `confirmLabel`, `cancelLabel`, `tone?: 'primary' \| 'danger'`, `busy?`, `confirmDisabled?`, `onConfirm`, `onCancel`, children | Native `dialog` with `showModal`. Named by `title`. Escape calls `onCancel` unless `busy`. Focus returns to the opener. Stays mounted; content renders only while open. |
| `Icon` | `icon: LucideIcon`, `size?` (18), `className?` | Always `aria-hidden`. Import glyphs by name from `lucide-react` in your own file. |

Account control: `useAccount()` from `AuthGate.tsx` returns
`{ mode: 'cloud' | 'preview', available, busy, act } | null`. Only the shell renders it.

## Class naming

BEM-like, prefixed per screen, defined in that screen's CSS file:

| Screen file | Prefix |
| --- | --- |
| `home.css` | `home-` |
| `sharing.css` | `sharing-` |
| `relationships.css` | `rel-` |
| `settings.css` | `settings-` (Settings screen, Scheduling, Budget) |
| `ai-settings.css` | `ai-` |
| `auth.css` | `auth-` |
| `placeholders.css` | `soon-` |

Form: `.home-band`, `.home-band__marker`, `.home-band--empty`. State comes from ARIA or
data attributes (`[aria-current]`, `[data-status]`), not extra state classes. The shell
owns `shell-`; primitives own `btn`, `field`, `check`, `section`, `chip`, `notice`,
`empty`, `dialog`, `icon`.

Legacy transitional styles have been removed after every screen migrated. Contract
classes such as `.member-row` and `.received-text` remain in their screen styles.

## Contract: do not change

Browser suites (`backend/scripts/browser_smoke.py`, `backend/scripts/auth_smoke.py`,
`backend/dbtests/test_membership_browser.py`) locate by role plus the exact English
catalog value, by label text and by these classes:

- `.app-shell` (never on auth screens), `.brand-mark` (text is U+25D2), `.entry` (one per
  saved reflection, contains its text), `.history-item` (one per decided check-in, status
  text in its own element), `.draft-card` (contains the draft `textarea`), `.member-row`
  (member alias plus contact status text), `.received-text` (opened shared copy, exact text).
- Destinations are `button`s named exactly `home`, `relationships`, `growth`, `bartender`,
  `settings`. Do not add another always-visible button with one of those names.
- Theme and language are native `select`s named by `theme` and `language`.
- Auth screens have exactly one `role="status"` element, and it is always present.
- Account control is a button named exactly `signOut` or `cloudAccount`, once per page.
- Relationship cards are `article`s whose accessible name is the relationship label.
  Sharing, Scheduling, Budget and AI consent are regions named by `sharingTitle`,
  `scheduleTitle`, `budgetTitle`, `aiConsentTitle`. The invitation review is a region
  named by `invitationReview`. The sharing review is a `dialog` named by `sharingReview`.
- Label text matched exactly includes: `email`, `password`, `newPassword`,
  `confirmPassword`, `relationshipLabel`, `memberAlias`, `joinConsent`, `inviteEmail`,
  `inviteLink`, `showArchived`, `sharingReflection`, `relationships` (inside Sharing and
  Scheduling), member aliases as checkbox labels, `budgetPersonalLimit`, `budgetPause`,
  `aiJournals`, `aiDocuments`, `aiApproveProvider`, `aiExcludeItem` + `: ` + text,
  `scheduleEnabled`, `schedulePaused`, `cadence`, and the draft textbox named `review`.
- Everything a test fills or clicks is reachable without an extra click. Nothing a test
  uses may sit inside a closed disclosure.
- Icons never carry text alternatives. Do not add `aria-label` to a control that already
  has a catalog string as its name.
- Guards stay as they are: request sequencing, stale-response checks, revision and version
  arguments, confirmation before leave, block and share, disabled states, the cloud versus
  local-preview split and sign-out behaviour.

## Copy

- Every visible string, including `aria-label` text, comes from `shared/locales/*.json`
  through `t()`. Add a new key to all seven catalogs (`en`, `it`, `es`, `ko`, `zh-Hans`,
  `yue-Hant`, `de`) in the same change, with a real translation in each; `npm test` fails
  on a missing, extra or empty key.
- Name keys with your screen prefix in camelCase (`homeBandLabel`, `relInviteHint`) so two
  agents never add the same key. Do not rename or delete existing keys, and do not change
  an English value that a test reads unless the meaning must change.
- Plain verbs, the person's point of view, buttons say what happens. Sentence case. No
  arrows on buttons, no middle-dot joined strings in new copy. Empty states invite an
  action; errors say what happened and what to do.
- Never imply a couple, two people, a gender or a relationship shape. Solo is complete.
- Keep every safety and honesty statement (fictional data only, live AI off, mock costs,
  sharing limits, what blocking and leaving do). Tighten wording if needed; never drop or
  soften the meaning. Do not present planned features as working.
- No untrusted HTML and no `dangerouslySetInnerHTML`. Format dates and numbers with `Intl`
  in the current language.

## Checks

Run from the repository root, one at a time: `npm test`, `npm run build`,
`npm run test:browser`. `npm run test:auth` covers the auth screens with simulated
endpoints. `npm run test:membership` needs the local test Postgres.

## Integration notes

The day-band model is in `src/day-band.ts`, with timezone, overnight quiet hours,
snooze and DST tests. The band is a wall-clock summary of actual records, not a
schedule forecast; repeated DST-hour marks can overlap. Manual theme changes also
update browser chrome. Narrow signed-in headers use a second row for language.

Draft translations recovered from the interrupted workflow and completed in all
seven catalogs are checked for literal/conditional source keys, registered dynamic
keys and interpolation parity. Native-speaker and professional safety review are
still pending. Run all browser suites sequentially; see the verification runbook.
