# Shared resources

`locales/` holds en, it, es, ko, zh-Hans, yue-Hant and de catalogs. Browser UI and
mock worker read the same localized mock prompt/draft keys. No real journal text,
secrets, provider credentials or per-user personalization belongs in these files.
Run `npm test` for catalog parity/encoding. Native/safety review is still required.


Crisis resources and private safety notices: see
[CRISIS-SUPPORT](../docs/implementation/CRISIS-SUPPORT.md). The static help panel
works outside authentication, selects country only on user input and hides expired
emergency numbers. Private notices store allowlisted metadata only. Topic advice
and automatic crisis responses require professional locale review; live AI stays
off. No automatic contact, location lookup or third-party widget is introduced.
