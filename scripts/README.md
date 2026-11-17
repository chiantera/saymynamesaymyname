# Workspace scripts

- `dev.mjs` starts the local fictional Vite/API/SQLite worker and stops its own child
  processes; it never provisions a cloud worker or paid service.
- `check-locales.mjs` validates catalog keys, interpolation, nonempty text and source
  encoding/contracts. Catalog totals come from the files, not Markdown copies.
- `check-docs.mjs` validates local Markdown targets/anchors and the single-guide,
  short-status, indexed-plan documentation contracts.

Use [testing](../docs/TESTING.md) for commands. Cloud worker configuration belongs
in its [runbook](../docs/implementation/CLOUD-SCHEDULING.md), not the dev launcher.
Never pass production credentials as command-line arguments.
