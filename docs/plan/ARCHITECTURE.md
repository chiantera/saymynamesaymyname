# Architecture and sibling reuse

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-13"></a>

## 13. Reuse from the SchedaPRO sibling

`./schedapro/` is **our own codebase** (we built it). It's the third in a product
family — **PLT (legal) → SchedaPRO (fitness) → this (relationships)** — that recycles
infrastructure and swaps the domain. We may **copy snippets, lift whole files/folders,
and rewrite them** freely; no licensing concern.

**Domain mapping (PLT/SchedaPRO → here)**
- *scheda cliente* (per-client page) → **per-relationship page** (the central object;
  also the `buildCaseContext()` unit).
- *Aria* (AI persona) → **the bartender** (advisor).
- *buildCaseContext() / mergeWithAi()* → our **context-builder** (§9).
- Flash/Pro routing → **DeepSeek/Anthropic** cheap/strong split (§9a).

**Strong reuse candidates (port + rewrite to our needs)**
- AI provider routing (`ai_service.py`) — DeepSeek primary, fallback (§9a).
- `analysisManager.ts` resilient background jobs (§8).
- `domain/redaction.ts` anonymization before AI (§12).
- `lock/` app-lock module — PIN + biometric + idle (§12 device safety).
- Settings page architecture + prefs store (nightshift branch) → our settings + §3c-D.
- Encrypted export + user-scoped storage namespace (§12).
- `components/MultiFileUploadDrawer.tsx` → our **context-source ingestion drawer**
  (§2c). Keep: the bottom-sheet shell, the per-item upload **queue** (pending/
  uploading/done/error + retry), **voice-note** capture → transcribe, **URL import**,
  and an in-UI **privacy notice**, rewritten to reflect our actual cloud retention
  and OCR/provider processing rather than claiming originals stay on device. Rewrite: replace fitness categories (`scheda`/`documento_medico`)
  with **visibility at upload time** (default *private*, opt-in *shared with
  relationship* — enforces the entries-visibility split in §5); make **image→OCR**
  explicit (Mistral OCR / Claude vision, §9a); **tag all ingested context as untrusted
  data** before it reaches the composer/bartender (§12 prompt-injection layer); drop
  the "Avvia Analisi AI / focus presets" fitness tail (our flow ends at "added to
  context"); route all copy through i18n (§10). ~60–70% of structure reusable; the
  domain tail is not.
- Process artifacts: `SOUL.md` + `docs/superpowers/plans|specs` convention.

**Guardrails rule — NEVER DOWNGRADE.** Our §12 guardrails are **stronger** than
SchedaPRO's. When porting any code, **keep our guardrails on top** — do not inherit the
sibling's lighter safety posture. Specifically: untrusted-content-as-data (prompt
injection), coercive-control/stalking refusal, the recipient-reachability gate (§8),
crisis protocols, and cross-member privacy must all survive the port. If ported code
conflicts with §12, §12 wins.

**Client stack — DECIDED (2026-11-14)**
- **React + Vite + TypeScript + Capacitor**, reusing and adapting SchedaPRO's web
  components, settings, upload drawer, and client infrastructure. This supersedes
  the earlier Expo/React Native direction. Web and native builds share the React UI.
- Plan Android and iOS wrappers; native permissions, push registration, deep links,
  secure storage, and app lifecycle handling require platform-specific validation.
  iOS build/signing requires access to macOS/Xcode; store accounts/signing are release
  prerequisites, not blockers for the initial web prototype.
- Use Capacitor-compatible integrations rather than Expo-specific packages. Push
  credentials and delivery adapters must cover the chosen native platforms; web
  push is a separate integration. Audit copied browser APIs and WebAuthn against
  each target platform before relying on them.
- Client choice is independent of hosting. FastAPI and Vercel directions are now
  decided (§14); Vercel plus a Frankfurt processing worker and durable Supabase job state are decided.
