# Draft locale catalogs

Seven locales, 295 keys each at this milestone. Mandarin/Simplified and
Cantonese/Traditional are separate preferences. JSON is UTF-8; keep interpolation
names aligned. Human and specialist safety review remains pending. Static worker
copy is mock output; localization alone does not enable an AI provider.

AI consent foundation: Settings and guarded SQL persist private source preferences,
reflection exclusions and versioned provider/capability/fallback approval. Real
provider controls remain unavailable pending review. Details: docs/implementation/AI-CONSENT.md
at repository root. No mock-worker journal access or external AI activation.

Budget integration adds owner-only usage/ceiling/pause controls and a separate
restricted accounting role. Exact reservations and unresolved holds are tested with
fictional prices; live AI is disabled. See docs/implementation/AI-BUDGET.md at root.

The checker parses TypeScript/TSX translation calls, conditional keys and section
labels as well as catalog parity. Dynamic statuses/capabilities and planned lists
have explicit key contracts; new dynamic families must extend that contract.
Interpolation names must match English. This does not certify translation quality.
