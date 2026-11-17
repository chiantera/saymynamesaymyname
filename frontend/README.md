# Frontend

React/Vite/TypeScript shared web UI with Capacitor configuration. Native Android
packaging, permissions, auth and device push remain unverified. Do not claim that a
browser pass proves a native release. Use the root `npm run dev` for the local demo.

[DESIGN.md](DESIGN.md) defines the visual/accessibility contract. [src](src/README.md)
maps screens and data boundaries. [Tests](tests/README.md) cover pure contracts;
[testing](../docs/TESTING.md) describes browser/SQL fixtures and serial build rules.

Cloud ownership/grants are enforced server-side. Browser refresh batches verify
identity and account generation; [polling](../docs/implementation/POLLING.md) pauses
in hidden tabs. Vite production previews enforce the same [security headers](../docs/implementation/SECURITY-HEADERS.md)
as Vercel, with an isolated fixture-origin substitution only for auth tests.

All locale copy is draft. Growth/Bartender are previews; live AI is disabled.
[Current status](../CURRENT-TASK.md) is the capability source of truth.
