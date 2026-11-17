# Browser smoke scripts

browser_smoke.py exercises the fictional local adapter. auth_smoke.py intercepts
Auth/cloud requests with synthetic sessions; it cannot certify Google delivery.
Run the npm wrappers at repository root. Scripts start dedicated local ports and
clean up only their own processes. Evidence goes to ignored .local/screenshots/.

`ui_checks.py` loads the npm-pinned axe-core bundle for fixture-only WCAG A/AA
checks. Auth audits sign-in/signup/recovery/beta states; the SQL-backed browser
suite audits membership, sharing review and private settings. The preview smoke
covers all seven languages in light/dark at 360px and 1440px. Browser suites must
run sequentially. No test should target real beta accounts.
