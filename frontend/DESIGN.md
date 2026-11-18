# Design reference: warm neutral and plum

Warm neutral surfaces, one deep plum for everything you can press, soft rose for
"now" and attention. Hierarchy comes from spacing, type and hairlines, not from
cards. Read this before touching a screen.

## The three shapes rule

Anything a person can press must look pressable, and nothing else may.

- **Buttons** are pills (`--radius-button`) with a plum fill (primary) or a plum tint
  (secondary), never an input-like border. Destructive buttons are outlined in red.
- **Fields** (inputs, selects, textareas) are rounded rectangles (`--radius-control`)
  with a visible border on a white surface.
- **Statuses** (`Chip`) are plain coloured text with a dot or icon: no border, no fill.
- **Links** are underlined plum text. In-page section links are text with a marker for
  the current section, never boxes.

The shell always shows who is using the app: the signed-in email with an initial
avatar, or "Not signed in" in the fictional preview.

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
| `--paper` | `#f6f3f1` | `#161218` | Page background |
| `--surface` | `#ffffff` | `#211b24` | Rail, cards, fields |
| `--ink` | `#241d26` | `#f3eef3` | Text |
| `--muted` | `#675e6b` | `#b7adba` | Secondary text |
| `--line` | `#e6e0e3` | `#352d39` | Hairlines, decorative borders |
| `--line-strong` | `#8d838f` | `#85798a` | Field borders (3:1 non-text contrast) |
| `--action` | `#5e2b63` | `#dcb3df` | Primary buttons, selected nav, links |
| `--action-ink` | `#ffffff` | `#2a1230` | Text on `--action` |
| `--action-hover` | `#4b2050` | `#e8c9ea` | Hover fill of primary buttons |
| `--action-wash` | `#f1e7f1` | `#36283a` | Secondary buttons, selected nav, avatars |
| `--lamp` | `#d4728b` | `#ee9ab0` | Rose highlight: now, pending, attention. Marks only |
| `--lamp-wash` | `#fbe9ee` | `#3c2530` | Tinted fill behind rose text |
| `--lamp-ink` | `#8b2c46` | `#f7cad6` | Text on `--lamp-wash`, pending statuses |
| `--danger` | `#b3261e` | `#f3a097` | Destructive actions, errors |
| `--danger-ink` | `#ffffff` | `#2a1210` | Text on `--danger` |
| `--danger-wash` | `#fbecea` | `#3b2322` | Error notice fill |
| `--success` | `#2f6b4f` | `#8fd1b0` | Confirmations |
| `--wash` | `#efeaed` | `#2b2330` | Quiet fills: hover, quiet-hours shading |
| `--backdrop`, `--float-shadow` | | | Dialog backdrop; the single elevation |

Contrast (WCAG AA, measured 2026-11-18): text tokens are at least 5.2:1 on `--paper`,
`--surface` and `--wash` in both themes; `--action-ink` on `--action` is 10.5:1 light and
9.4:1 dark; `--lamp-ink` on `--lamp-wash` is 7.1:1 and 9.6:1. `--lamp` is never text and
never a text background. `--line` is decorative only; fields use `--line-strong`.

Theme: `html[data-theme]` is `system`, `light` or `dark`. Explicit wins, otherwise
`prefers-color-scheme`. The dark values exist twice in `tokens.css`; never hard-code a
colour in a screen file, and never write a `prefers-color-scheme` query of your own.

## Type

- One family: Figtree Variable for display and text (`--font-display`, `--font-text`).
  Display weight `var(--weight-display)` (680; 600 for ko, zh-Hans, yue-Hant), tracking
  `var(--tracking-display)` (-0.015em; 0 for CJK). CJK falls back to `--font-cjk`.
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
- Radius: `--radius-button` (pill) for buttons only, `--radius-control` 10px for fields,
  `--radius-surface` 16px for cards. Avatars are circles.
- Elevation: `--float-shadow`, only on dialogs, the mobile tab bar and toasts.
- Controls are at least `--control-height` (44px).
- Motion: `--motion-fast` 120ms, `--motion-base` 180ms, `--ease`. Only in response to an
  action. No entrance animations. `base.css` disables all motion under reduced motion.
- Logical properties only: `margin-inline`, `padding-block`, `inset-inline`, `inline-size`,
  `text-align: start`. No `left`/`right`.

## Layout

- 720px and wider: sticky left rail (`--rail-width`) with brand, five destinations and a
  footer (who is signed in, account control, mode notice, language). Narrower: header (brand, language,
  account control), identity and mode notice at the top of the content, fixed bottom tab bar.
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
| `Chip` | `tone?: 'neutral' \| 'action' \| 'lamp' \| 'danger'`, `icon?` | Status only, never clickable: coloured text with a dot or icon, no box. Lamp means now, pending or attention. |
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
