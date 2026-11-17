# 0003 — Enforced browser security headers

Accepted 2026-11-17. Apply a source-restricted CSP, no-framing, HSTS, no-referrer,
nosniff and sensitive-feature Permissions Policy to all Vercel app/asset paths.
No inline/eval scripts, broad processor wildcard or external font source is needed.
React's current dynamic styles retain a narrowly documented style-attribute allowance.

Production-build fixtures enforce the policy without CSP bypass. Only their exact
isolated connection origin is substituted. Negative script/fetch/frame probes and
positive auth/sharing regressions accompany actual hosted header checks. Future
voice/media integrations require an explicit permission/policy review; adding a
provider key never relaxes the browser allowlist. [Contract](../implementation/SECURITY-HEADERS.md).
