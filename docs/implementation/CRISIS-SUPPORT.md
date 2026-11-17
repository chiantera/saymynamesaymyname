# Crisis paths and regional resources

Implemented 2026-11-17. Live AI and network processing remain disabled. This slice
adds a static help panel, guarded regional contacts and private worker notices; it
does not claim clinically evaluated crisis detection or a running AI service.

## What users can do now

Get help and Quick exit are available outside the authentication gate, in the
fictional preview, while signed out and during provider/API failures. Opening help
does not require a model, consent grant, budget, network lookup or a relationship.
The built client includes the catalog; first loading the website still needs a
connection. This is not an offline-install/PWA guarantee.

The panel contains sourced emergency contacts and links to external support
directories. It makes no contact automatically. Country/region and topic are
explicit, temporary selections, cleared on close or account change. No GPS, IP
inference, language-based location, saved risk profile or product analytics event
is added. No resources are embedded, prefetched or loaded from a remote widget.
External links omit the referrer and open only on user action; the destination has
its own privacy practices. Directory coverage, eligibility and languages vary.

The topic paths self-harm, violence and stalking have separate draft copy in all
seven catalogs. **Topic-specific advice is not displayed until its exact locale is
professionally reviewed:** `shared/crisis-resources.json` has `reviewed_locales=[]`.
The current panel shows general, factual resources instead. Automatic persona-drop
responses are separately disabled (`automatic_crisis_copy=false`); a topic selection
or worker verdict cannot enable them. Professional/native review, evaluated intake
and a reviewed response policy are still release/activation gates. PLAN §12's
approved artificial-bartender introduction and gentle “And drive safe” closing are
preserved for that review; neither replaces immediate factual emergency resources.

Quick exit replaces the current history entry with a fixed neutral Wikipedia URL.
It does not erase history, end device monitoring, guarantee a hidden visit, revoke
sessions or delete an account. The panel explicitly explains those limits and
links to NNEDV's safer-device resources. Closing the panel restores opener focus;
Escape works without a network request.

## Resource facts and maintenance

`shared/crisis-resources.json` is a curated, versioned catalog. Numbers are never
accepted from a model or caller. Source checks were performed on 2026-11-17:

| Coverage | Contact facts | Primary source |
| --- | --- | --- |
| 27 EU member states | 112 emergency services | [European Commission](https://digital-strategy.ec.europa.eu/en/policies/112) |
| United States | 911 emergency services | [National 911 Program](https://www.911.gov/calling-911/) |
| United Kingdom | 999 police emergencies | [GOV.UK](https://www.gov.uk/contact-police) |
| Hong Kong | 999 ambulance/fire/police | [FCDO](https://www.gov.uk/foreign-travel-advice/hong-kong/getting-help) |
| South Korea | 112 police; 119 ambulance/fire | [Australian Embassy](https://southkorea.embassy.gov.au/seol/consular.html) |
| Mainland China | 110 police; 120 ambulance; 119 fire | [FCDO](https://www.gov.uk/foreign-travel-advice/china/getting-help) |

These are 32 explicitly covered countries/regions, not a worldwide number database.
Unknown/unsupported selections have no guessed dial button. Country is independent
of UI language, Mandarin/Cantonese preference, region defaults and timezone.
Short codes are local to the selected jurisdiction, not international dialing
instructions. The panel asks where the person is now.

Numbers expire after at most 90 days (current deadline 2027-02-15 00:00 UTC).
Expired, future-dated or invalid-clock facts lose their dial links; the official
source remains available for rechecking. Unknown countries retain directory links.
Device clock checks are a convenience guard, not an authenticated time service.

Directories: [Find A Helpline](https://findahelpline.com/about) for emotional
support, [Lila.help](https://lila.help/) for violence/abuse, and
[NNEDV Safety Net](https://www.techsafety.org/resources-survivors) for device safety.
These are user-selected links, not guarantees of a service in every location or
eligibility for every person. No suicide-specific telephone number is hardcoded.

To refresh facts, open the primary source, check each service and jurisdiction,
record the actual verification date, set a deadline within 90 days, run the helper
and browser suites, and publish. Do not extend dates without re-verification.
Add professionally reviewed locales only after review of the exact topic copy;
that does not activate automatic responses, live AI or a semantic assessor.

## Generated-output failures are not user crises

The current AI adapter receives fixed solo task input, not user disclosures.
`backend/app/crisis.py` strictly maps typed allowlisted safety failures; arbitrary
exception strings are never saved as reasons. The worker holds the leased AI job
and writes a minimized owner-only notice for self_harm, violence, stalking, refuse
or unavailable. No rejected prompt/draft, classifier rationale, country, phone,
clinical diagnosis or personal disclosure is stored. Valid reported usage/unknown
cost holds remain in the separate usage ledger. No failed output becomes a draft,
mock fallback, shared message or automatic emergency alert.

The notice UI initially retrieves only an ID and says content was withheld. A
user action reveals the allowlisted category and opens help, explicitly stating
that generated content is not an assessment of the user. No sensitive category
appears in notification previews, the queue list, analytics or a shared timeline.
Dismissal deletes the owner's notice; another member cannot read/dismiss it.
Account/job deletion cascades. Notice retention otherwise lasts until dismissal or
source job deletion; no hidden long-lived derived risk profile is created.

`companion_private.support_notices` has RLS and no client/worker/meter table grants.
The narrow `support_notice` invoker wrapper delegates to an authorized private
function that verifies current `auth.uid()` and verified beta access. Peek/reveal/
dismiss always use the authenticated owner; a supplied owner field grants nothing.
The private AI worker core is ungranted; its wrapper creates notices only for a
matching, unexpired, processing DeepSeek lease. Cleanup remains possible after a
kill switch/revocation. Duplicate or stale holds cannot create/overwrite a notice.

This path does not diagnose a user or automatically pause their unrelated activity,
block another person, suspend group members or notify support/partners. A future
real user-disclosure intake needs reviewed persona-free responses and the separate
after-episode action policy before activation; this milestone does not silently
turn deterministic output indicators into such an intake system.

## Verification

Pure tests cover strict static mappings, unsupported origins, regional selection,
expiry/invalid clocks, distinct Korean/Chinese services and disabled review gates.
Disposable PostgreSQL fixtures exercise the whole mock-HTTP worker → held job →
private notice → explicit reveal/dismiss path, current/stale leases, other-user
denial and unavailable-safety handling. Hosted smoke is read-only.

The browser matrix covers 28 support-panel locale/theme/width combinations in
addition to the 140 existing screen combinations, keyboard focus, country reset,
absence of automatic external requests, and English axe checks. A neutral exit is
intercepted locally and checked for absent referrer; no emergency call is tested.
Auth tests check signed-out access; SQL-backed browser tests verify private notice
reveal/dismiss. Android/device behavior and clinical/native review remain pending.


Hosted verification: migration applied; read-only ACL/schema smoke passed. Existing
mock cron remains active. Live budget flag is false; enabled provider/safety rows,
prices, attempts, AI jobs and notices are all zero. Security advisors report the
expected new private RLS/no-policy INFO; the pre-existing leaked-password warning
is unchanged. No real user notice or external call was created for verification.
