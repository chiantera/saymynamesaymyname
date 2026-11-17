# Styles

Import order is defined in `../main.tsx`: self-hosted fonts, tokens, base controls,
shared components, shell, then screen styles. `tokens.css` owns colors and scale;
explicit and system dark palettes must remain equivalent. Use logical properties
and the documented screen prefixes. No external font service is requested.

`shell.css` switches desktop rail/mobile tabs at 720px. At narrow cloud widths,
language gets a second header row to preserve account controls. Screen styles keep
long translated labels and user names inside their containers. Reduced motion is
handled globally by base.css. Legacy compatibility rules have been removed.

See ../../DESIGN.md and the root browser suites for layout/accessibility checks.
