# Shared resources

`locales/` holds en, it, es, ko, zh-Hans, yue-Hant and de catalogs. Browser UI and
mock worker read the same localized mock prompt/draft keys. No real journal text,
secrets, provider credentials or per-user personalization belongs in these files.
Run `npm test` for catalog parity/encoding. Native/safety review is still required.
