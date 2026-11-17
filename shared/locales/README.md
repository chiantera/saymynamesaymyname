# Locale catalogs

Launch catalogs: `en`, `it`, `es`, `ko`, `zh-Hans`, `yue-Hant`, `de`. Mandarin and
Cantonese preferences remain distinct; explicit choice wins over inferred defaults.
English supplies source keys. Use native Intl formatting rather than translating
private user text or inferring country from language.

Run `npm test` for key/interpolation/encoding/source checks. All translations remain
drafts requiring native review; topic-specific crisis copy also needs professional
review before display. Never activate a locale by merely filling its JSON keys.
Mock workers read the same trusted prompt/draft keys. [Localization specification](../../docs/plan/LOCALIZATION.md).
