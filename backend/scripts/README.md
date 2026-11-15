# Browser smoke scripts

browser_smoke.py exercises the fictional local adapter. auth_smoke.py intercepts
Auth/cloud requests with synthetic sessions; it cannot certify Google delivery.
Run the npm wrappers at repository root. Scripts start dedicated local ports and
clean up only their own processes. Evidence goes to ignored .local/screenshots/.
