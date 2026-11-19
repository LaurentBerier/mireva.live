# Agency platform implementation

Mireva extends Postiz `2f24e10f2204295f66a1999679e9896db3cb2094` on `main`. It contains a working local agency foundation and additional publishing, reporting, engagement and growth modules. It is **not complete Postiz + Metricool feature parity or a production release**. The [inventory](feature-inventory.md) and [machine-readable statuses](feature-inventory.json) identify implemented, partial and pending capabilities independently from credentials, platform review and live verification.

The original Postiz interface, providers, REST API, extension, CLI and MCP are retained. The Agency section adds brands, client reviews, imports, delivery reconciliation, insights, reports, inbox, keyword flows, link pages, website statistics, advertising accounts and team administration. Paid and irreversible integrations are disabled locally.

## Run locally

Use Node **22.23.4**, pnpm **10.6.1** and Docker Desktop. Commands run at the repository root. If a different pnpm is installed, use `pnpm dlx pnpm@10.6.1` in place of `pnpm`; do not regenerate the lockfile with pnpm 11.

1. `pnpm install --frozen-lockfile`
2. Copy `.env.agency.example` to `.env`. Set unique `JWT_SECRET`, `ENCRYPTION_KEY` (32 random bytes encoded as base64), and `AGENCY_OWNER_EMAIL`.
3. `pnpm agency:infra:start`
4. `pnpm agency:local:env` fills the local Supabase endpoint, publishable/service keys and S3 credentials without logging their values.
5. `pnpm agency:db:deploy`
6. `pnpm agency:bootstrap --local` creates the local owner, agency, first approval-required brand and private media bucket. The disposable local owner's generated password is in ignored `.secrets/agency-local-owner.json`. Remote bootstrap sends an email invitation instead.
7. `pnpm agency:temporal:prepare`
8. `pnpm agency:build:services`
9. `pnpm agency:source`
10. `pnpm agency:dev` starts the API on port 3000, frontend on 4200 and Temporal workers. Open `http://localhost:4200/agency` and sign in with the local owner.

The local Supabase project is `agency-workspace` (API 55321, database 55322, Studio 55323). Redis uses 56379 and Temporal 57233. Its data is separate from other local projects. Do not run `db push`, reset, or upstream PM2 scripts against a deployed agency database; use the checked-in migrations.

`PUBLISHING_ENABLED`, `ENGAGEMENT_ENABLED`, `ADS_WRITES_ENABLED`, `RUN_AGENCY_SYNC` and `NEXT_PUBLIC_AI_ENABLED` start false. Enabling publishing alone does not bypass client approval. Set email delivery before invitations/recovery or scheduled reports are evaluated remotely. Local Auth disables public signup while keeping the email provider enabled.

## What is enforced

- Supabase verifies session identities on the server; Postiz memberships grant access. Client-controlled Auth metadata grants no role. A revoked membership stops existing sessions and approved OAuth applications from accessing that brand.
- Disabling or demoting a brand administrator rotates the legacy shared brand API key because that administrator could have copied it. Update automations using that key; prefer individual OAuth authorizations for revocable access.
- Client reviewers see their assigned brands, reviews and reports. Agency administrators create brands and set the approval policy; brand staff cannot disable approval.
- A review includes content, owned ready media, thumbnails, publishing options, destination identity, timezone, scheduled instant, recurrence and publishing automations. Changes invalidate it. Scheduling and each provider mutation recheck the reviewed version.
- Content changes and publish claims share a brand transaction fence. Durable delivery attempts use stable occurrence keys. Uncertain outcomes block retries and edits until an administrator verifies the native outcome and records evidence.
- Browser uploads use signed resumable TUS, server content/size checks and a new sealed object key before media becomes usable. Download authorization checks brand ownership before issuing short-lived links.
- App tables are in `postiz`, excluded from Supabase's exposed Data API. Social tokens remain encrypted and are used by backend/worker processes. Use a direct/session database connection for Prisma; transaction pooling requires separate evaluation.
- Recurrence preserves the reviewed brand wall time across DST. A spring-gap occurrence advances through the gap, then returns to the original wall time. After downtime, only one recently missed occurrence can catch up within two hours; stale occurrences advance to a future grid time.

## Validation

Run `pnpm agency:test` against the dedicated local database. These include real database concurrency/approval/delivery tests, DST recovery, import leases, seven new adapter payload contracts and registry coverage for every inherited provider. Registry checks are **not** full publishing contract tests for those providers.

With the local API and frontend running, `pnpm agency:test:http` exercises actual Supabase login, the frontend HttpOnly session bridge and origin checks, role/brand access, private TUS uploads, concurrent completion, report files/shares, read-only connector keys, API approval rejection, Temporal scheduling/cancellation and draft CSV imports. It creates isolated fixtures, uses no live social credentials, and cleans its own data.

`pnpm agency:test:restore` dumps and restores the application schema into a temporary local database, compares model counts, and restores a private object with a matching SHA-256. `pnpm agency:test:temporal-restore` restores both Temporal databases into a disposable database/server pair and verifies a queued workflow, history and visibility results without workers. Hosted Auth/PITR and complete disaster recovery remain staging exercises in the [release runbook](runbook.md).

Backend/orchestrator compilation, frontend type checking and the extension build are separate checks. The report QA renders multi-page PDFs and PowerPoint tables from clearly identified synthetic fixtures. Reports and local logs under `reports/agency-*` are ignored and excluded from the corresponding-source bundle.

The HTTP scheduling check also requires the orchestrator from `pnpm agency:dev`; it verifies the worker's captured review fingerprint. After generating the source archive and building `agency-workspace:local-20261119`, `pnpm agency:test:image` checks Linux startup, Supabase identity verification and the matching source download under the production backend's CPU/memory limits. Set `AGENCY_TEST_IMAGE` for a different local release tag. This does not certify ten-brand load capacity.

## Deployment and remaining delivery

Mireva targets [mireva.live](https://mireva.live), the existing Sandscape Pro team's Vercel project [`mireva-live`](https://vercel.com/sanscape-breakingwalls/mireva-live), and Supabase project `ggvmlijdzhmeqkgsgepc`. The selected hosting path is [Vercel Services/Daemons with managed Temporal and Redis](vercel.md). See [Mireva settings](mireva-deployment.md), [runbook.md](runbook.md), [provider-setup.md](provider-setup.md) and [costs.md](costs.md). Hosted Auth, all six private-schema migrations and private storage/S3 credentials are configured. The Mireva Temporal namespace, scoped API key and dedicated Upstash Free Redis connection passed TLS checks. Vercel builds and workers remain held pending a usage budget; staging, SMTP and developer applications remain release inputs. No production deployment is ready and no owner invitation has run.

Remaining product work includes evergreen category queues, a dedicated reusable-post library, richer audience/format and hashtag discovery, more competitor collectors, unified campaign attribution, broader inbox surfaces and notes, richer dashboard/report layouts, complete advertising creative/targeting flows and external editor/media onboarding. All inherited providers remain in scope and visibly unverified until their approved connection/publishing/analytics/messaging workflows pass live tests.

The source repository is [LaurentBerier/mireva.live](https://github.com/LaurentBerier/mireva.live), derived from the pinned Postiz revision with its history and license preserved. The local `upstream` remote tracks Postiz and `origin` points to Mireva. `pnpm agency:source` creates the public corresponding-source archive; the Docker image compiles **from that archive**, so the served source matches its implementation.
