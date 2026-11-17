# Localization and worldwide access

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-10"></a>

## 10. Localization & internationalization (i18n / l10n)

This app is **harder than usual** to localize because most of its content is **AI-
generated**, delivered across **many channels**, and includes **safety-critical**
copy. Two distinct streams: **static UI** (translation files) and **dynamic AI text**
(generated directly in the user's language). Plan for both from the start — retrofitting
i18n is expensive.

**Locale model**
- Each user has separate **UI locale, conversational language and Chinese script**
  preferences, plus their IANA timezone (§8). Read browser/device preferences via
  the selected Capacitor/web integration; do not use Expo-specific packages.
- **Location-aware defaults — DECIDED:** preserve an explicit saved user choice
  first; otherwise honor a supported device language/script, using known country/
  region to select an appropriate regional default or break ambiguity. If no device
  preference matches, suggest a supported locale from known region; fall back to
  English when neither is available. Keep the initial choice visible and editable.
  Country/region is a suggestion signal, never a claim about the user's identity.
- Use an already known or user-supplied country/region; precise GPS is unnecessary
  for localization. Do not request location permission solely to choose a language.
  Travel or a changed device locale must not overwrite a saved preference. Language,
  script, country for help resources, and timezone remain independently editable.
- In a relationship, **each member may use a different language.** Consequence: a
  check-in/message is generated **per recipient, in that recipient's language** — not
  once for the whole relationship. The advisor speaks each user's own language.

**1. Static UI (i18n framework)**
- Use **i18next + react-i18next** with Git-versioned JSON catalogs (approved by
  delegation). No hardcoded UI strings; all copy via keys. Pin actual versions when
  adapting the sibling baseline; English is the catalog source, not a preference
  override for users of the other six supported languages.
- Handle **plurals**, interpolation, and **date/number/relative-time** formatting via
  `Intl` (e.g. "in 3 hours", anniversaries) — these are core to the scheduling UX.
- Prepare direction-aware layouts and mixed-script rendering from the beginning;
  full RTL interface locales arrive later under the approved localization scope.

**2. Dynamic AI content (the unusual part)**
- The **system-prompt core (§9)** gains an instruction: *respond in the recipient's
  locale* (passed by the context-builder). Validate each selected model on the seven
  launch languages; generate directly in-language. User-authored multilingual message
  translation is a separate audience/approval choice in §27, not permission to rewrite
  an already approved outward message silently.
- **Mirror the user's own language/terms** — ties into §1a inclusivity (pronouns,
  relationship labels differ across languages; grammatical gender must follow the
  user's stated terms, not assumptions).
- The **fallback prompt library (§2b)** must itself be localized (it's static text), so
  the heartbeat still speaks the user's language when the API is down.

**3. Channels**
- Push / SMS / email / WhatsApp / Telegram / calendar content all rendered in the
  recipient's locale. Watch SMS encoding (non-Latin scripts → UCS-2, fewer chars/segment).

**4. Voice / TTS (§2c)**
- TTS voice must match the content language; device-native and cloud-TTS voice
  selection keys off the user's locale.

**5. OCR / uploaded context (§2c)**
- Screenshots/docs may be in **any language/script**; vision/OCR must handle
  multilingual input. The AI can read and reason across languages natively.

**6. Safety-critical localization (non-negotiable)**
- **Crisis/abuse/self-harm resources are region-specific** (hotline numbers differ per
  country). Maintain a per-country resource table; the safety guardrail (§9) must
  surface the **right resources for the user's region/locale**, not a US default. Get
  these professionally verified.

**7. Cultural sensitivity**
- Relationship norms and humor vary by culture; the bartender persona may need light
  cultural adaptation, and the inclusivity stance must hold across locales (some
  markets are less LGBTQA+-friendly — we stay affirming regardless, while being mindful
  of user safety in hostile regions).

**Data-model touches**
- `users.locale`; localize the **fallback `prompts`** library and any seeded content;
  add a **`crisis_resources`** table keyed by country/region.

**Phasing**
- **Build i18n-ready from Phase 0** (framework, no hardcoded strings, locale plumbing)
  with **Italian, Spanish, Korean, Mandarin, Cantonese, English and German at launch**. Add the AI "respond in locale" instruction in
  Phase 1. Expand languages, RTL, and localized crisis resources as we roll out regions.

**Who translates what, and when (workflow — DECIDED)**
Translation responsibility splits by content type:
- **AI-generated content** (check-ins, advisor replies, digests, recaps): **nobody
  translates it — the approved model writes it natively in the recipient's locale** (§9).
  No translator, no pipeline, no lag. This is the bulk of what users read.
- **Static UI strings** (buttons, labels, onboarding, settings): extracted to locale
  catalogs.
  - *Launch language*: written in-house as we build (source of truth).
  - *Launch catalogs*: versioned in **Git**; use AI-assisted drafts followed by
    native-speaker review for each language. A paid external TMS is not required
    at launch; choose one later if volume and reviewer workflow justify it (§20).
- **Safety-critical & legal copy** (the "bar's closed" notice, crisis resources,
  consent/privacy, disclaimers, store listings): **professional human translation +
  verification — never machine-only.** A new language does **not ship** until its
  safety/crisis copy is professionally verified (gating requirement).
- **Crisis resources** (§10.6): sourced/verified **per country** by a qualified
  reviewer, not translated generically.

*Timing*: i18n plumbing from Phase 0 → ship Italian, Spanish, Korean, Mandarin, Cantonese, English and German → each added language goes
through catalog draft+native review for UI and **professional review for safety copy** before
that locale is enabled.

**Launch languages — DECIDED (2026-11-14): Italian, Spanish, Korean, Mandarin, Cantonese, English and German.**
This supersedes the earlier Italian/English-only scope. All seven belong to the launch
localization scope: navigation, settings, onboarding, permission/confirmation copy,
check-ins, advisor text, fallback notices and reviewed safety resources. Country
coverage is separate from language; never infer emergency resources from language.

**Chinese language/script handling**
- Treat Mandarin and Cantonese as distinct AI language preferences; do not collapse
  Cantonese into Mandarin or assume a generic Chinese prompt serves both.
- Separate UI locale/script from conversational language. Written Chinese UI and
  conversational Cantonese have different translation/review needs.
- **Script defaults — DECIDED:** Mandarin defaults to **Simplified Chinese**;
  Cantonese defaults to **Traditional Chinese**, with Cantonese phrasing in chat.
  A known region can refine an unset default: mainland China → Mandarin/Simplified;
  Taiwan → Mandarin/Traditional; Hong Kong or Macao → Cantonese/Traditional.
  Explicit language/script selections always win. These are configurable locale
  suggestions, not assumptions that everyone in a region speaks the same language.
  Users can choose Traditional Mandarin or Simplified Cantonese independently.
- Require native review for all seven launch languages, including Cantonese-specific
  conversational output, inclusive terms and safety copy. Test CJK fonts, wrapping,
  input methods and layouts on web/Android. Avoid text truncation and fixed heights.
- When audio is introduced, validate language-specific voice availability separately;
  a Mandarin voice is not a Cantonese fallback. Unsupported audio falls back to text.

**Open decisions**
- Worldwide intended access is decided; maintain per-country capability/resource review (§15).
- Next languages after the seven launch languages.
- RTL interface locales follow later; direction-aware layouts and mixed-script text support start now (§20).
- Assign native-speaker/professional reviewers per language; a TMS choice is deferred (§20).

---

<a id="section-15"></a>

## 15. Worldwide access implementation plan

- **Independent settings:** UI locale, conversation language, script, timezone and
  country/region are separate. At onboarding, offer a visible country suggestion from
  already available region information and let the user correct it or leave it unknown.
  Never infer country from language alone or require precise location permission.
  Travelling users can change the country used for local help without changing saved
  language preferences or the primary European data location.
- **Country capability registry:** server-owned records for country, feature/channel,
  available providers and last-reviewed state. Provider consent remains mandatory.
  Enable/disable only the affected integration when unavailable; preserve access to
  private journals, downloaded help material and saved history. Country-specific
  processor, distribution and commercial restrictions must be checked before enabling
  a feature there, not guessed from the user's language or bypassed through failover.
- **Help-resource directory:** expand `crisis_resources` with region, supported
  languages, emergency/support category, source URL, verification time and review
  status. Display reviewed resources for the user's current confirmed country.
  Unknown country → ask for country only when relevant to finding help; meanwhile
  give a clear general direction to local emergency services, without inventing a
  number or choosing a US/EU default. Known country without a reviewed specialized
  resource → say so and offer reviewed general help if available. Static basic
  safety messaging remains accessible without AI budget or provider availability.
- **Worldwide beta testing:** invite testers across supported locales/regions; test
  sign-in alternatives, actual network reachability, notification delivery, fonts/
  scripts, local times and country-resource resolution. Google sign-in availability
  cannot be assumed everywhere; email/password remains a separate option, also tested.
- **Feature-level rollout:** keep basic app access worldwide where service is available,
  while validating localized advisor safety, messaging and paid distribution per region.
  Seven interface languages do not imply seven supported countries or coverage of every
  world's language. Show supported-language choices honestly.
- **Backend authorization:** enforce admission, region/capability, pairwise/member,
  item, provider-consent and budget gates on the server. An unavailable capability
  must not leak private data to another provider or break export/delete access.
