# Styles

Follow [DESIGN.md](../../DESIGN.md). Tokens define bottle-glass, sage, amber,
self-hosted fonts, spacing, contrast and theme behavior. Shared primitives/shell
precede screen styles; use logical properties and preserve reduced-motion/focus
rules and touch targets. Do not fetch third-party fonts.

`support.css` keeps emergency resources readable and quick exit reachable in the
modal. React's dynamic day-band styles use the documented style-attribute CSP
exception; do not loosen script or stylesheet policy to add inline code.
[Header contract](../../../docs/implementation/SECURITY-HEADERS.md).
