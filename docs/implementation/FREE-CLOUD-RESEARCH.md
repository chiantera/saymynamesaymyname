# Free cloud research

Research checked 2026-11-17; pricing and eligibility can change. This is a comparison,
not a decision to provision a service, enable billing, or activate live AI.

The app currently uses its Frankfurt Supabase cron and a bounded static mock consumer.
Durable state remains in Supabase. External AI and slow network work must not run in
Postgres. The existing Python worker and Render configuration remain available.

| Option | Fit | Limits and costs to verify |
| --- | --- | --- |
| [Oracle Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) | An Always Free VM in the tenancy's home region could run the existing Python worker; Frankfurt must be the home region. | Oracle lists up to 2 Arm OCPUs and 12 GB memory under its stated free allowance. Capacity may be unavailable; idle instances can be reclaimed. A VM needs maintenance, monitoring and security updates. [Card verification](https://www.oracle.com/europe/cloud/free/faq/) is required. |
| [Koyeb free instance](https://www.koyeb.com/docs/reference/instances) | One free Frankfurt web service, 0.1 vCPU and 512 MB RAM, could run a bounded authenticated request handler. | Not eligible for Worker Services; sleeps after an hour without traffic. Koyeb describes it as a preview, not production. A request-driven worker requires implementation and testing; the free service itself is not a continuously running worker. [Card and plan details](https://www.koyeb.com/docs/faqs/pricing). |
| [Google Cloud Run](https://cloud.google.com/run/pricing) | Frankfurt containers can scale to zero and run bounded jobs or authenticated requests. | Billing must be configured. Free allowances are shared by billing account and based on Tier 1 pricing; Frankfurt is Tier 2, so published example unit quantities are not a Frankfurt guarantee. Network, storage and other services may add costs. Google bills at least one minute for each instance a Job starts. Starting one instance every minute for 30 days would consume at least 720 instance-hours. |
| [Render Free](https://render.com/docs/free) | Free web service for experiments; existing Render worker setup is preserved. | Free instances do not support background workers. Web services sleep after 15 minutes and have ephemeral files. Free Postgres expires after 30 days and has no backups. |

Cloud Run's [spend-cap budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)
can pause eligible services, but reporting delays can still cause billed overages;
ordinary alert budgets do not cap spending. Free quotas and verification requirements
must be checked on the actual account before setup. Never introduce another scheduler
or send sensitive payloads to an unreviewed service merely to test a host.

## Storage and existing services

[Cloudflare R2](https://developers.cloudflare.com/r2/pricing/) offers 10 GB-month of
standard storage and included monthly operations. Its [EU jurisdiction](https://developers.cloudflare.com/r2/reference/data-location/)
can restrict object storage to the EU; a location hint alone is not a guarantee.
This is a possible later home for original uploads, not implemented storage or a
replacement for access, retention, deletion, backup and processor review.

[Supabase Free](https://supabase.com/pricing) currently lists 500 MB database storage,
1 GB object storage and no automatic backups. Low-activity projects can be
[paused](https://supabase.com/docs/guides/platform/free-project-pausing). Plan and
test backup and restoration before relying on it for real user data.
[Vercel Hobby](https://vercel.com/docs/plans/hobby) is restricted to personal,
non-commercial use; revisit hosting before a commercial release.

## Recommendation and gates

Investigate Oracle Always Free in Frankfurt first if a continuously running worker is
needed; verify account eligibility and capacity before selecting it. Koyeb and Cloud
Run deserve comparison if we implement short request-driven execution. Keep the
existing mock executor until a replacement passes lease, retry, authorization, region,
secrets, monitoring and failure tests. Hosting in Frankfurt does not establish an AI
provider's processing location. Live AI and paid hosting require separate approval.
Each user controls their own schedule, including after a change of worker host.
