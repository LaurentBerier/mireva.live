# Vercel with managed Temporal and Redis

This selected target preserves the existing Next.js frontend, NestJS API, Temporal workflows and Redis integration. The separate Docker Compose deployment remains available in [runbook.md](runbook.md).

## Scope and current state

Use only Vercel project `prj_ibZkJGC9xoPdYEO2A511BC9mBVJ5` in team `team_kurxrvch5xQYnvwqbXi6xlbR`, and Supabase project `ggvmlijdzhmeqkgsgepc`. Confirm `.vercel/project.json` before provisioning or deployment. Never reuse another project's database, keys, Redis database, Temporal namespace or SMTP settings.

GitHub is linked. Public configuration and eight server-only Secrets, including the approved Supabase S3 key pair, are saved in Mireva's Vercel production environment; preview/development have no credentials. Supabase's invitation-only policy and site/callback URLs are saved. All six Prisma migrations are applied, with a dedicated `mireva_app` login owning the private app/memory schemas. Client schema usage and table access are denied; an actual Data API request for `postiz` returns `PGRST106`. The private `agency-media` bucket is created with a 50 MiB file limit, matching the current Free plan. No owner invitation or app deployment has run. The Vercel project still uses the original frontend root and an ignored-build command of `exit 0` while managed-service credentials are prepared.

## Layout

Root `vercel.json` defines `web` (Next.js), `api` (the existing NestJS container), and a `publisher` Daemon for the existing orchestrator. `/api/backend/*` routes to the API with that prefix removed by a service request-path transform. An explicit allowlist also sends the inherited root MCP/SSE transports and OAuth discovery metadata to the API. Other requests, including Next.js Auth routes and `/oauth/authorize`, go to the frontend. `BACKEND_INTERNAL_URL` is a private binding injected into the frontend at runtime, so Next.js must not bake it into build-time rewrites.

[Services](https://vercel.com/docs/services) and [Daemons](https://vercel.com/docs/daemons) are beta features. Daemons can run Temporal workers but do not host persistent state or inbound TCP services. Use Temporal Cloud and managed Redis for those dependencies. The worker remains at **zero instances**, with 2 GiB memory, health checks and a 60-second shutdown grace period configured for eventual activation.

`deploy/Dockerfile.vercel` creates a corresponding-source archive from its filtered build context and compiles that archive. Its Dockerfile-specific ignore file excludes credentials, logs, build output and deployment state while retaining source, license notices, documentation and lockfiles. The archive is served at `/api/backend/agency-public/source` after release.

## Managed dependencies and credentials

Create a dedicated Temporal Cloud namespace for each environment. `mireva-production.yb05k` is active in AWS `us-west-2` with 30-day retention and API-key authentication. Its dashboard-confirmed endpoint is `mireva-production.yb05k.tmprl.cloud:7233`; endpoint and namespace are saved in Mireva's Vercel production configuration. `organizationId` and `postId` are registered as Keyword search attributes. The service-account review uses account Read-Only, Project Member and Write only on that namespace; its creation and a 90-day API key await access approval. Store the API key privately; set `TEMPORAL_TLS=true`. The current `agency:temporal:prepare` command is for self-hosting; do not use it to provision Cloud namespaces.

The proposed Redis resource is `mireva-production-redis`, connected only to Mireva production. Upstash Free was selected with region `sfo1`, eviction disabled, production-pack features disabled, and automatic paid upgrades disabled. The owner accepted Marketplace terms for the original team. Provisioning is deferred until the separate Mireva team is ready, because project transfers do not automatically transfer integrations; install and verify the integration in the final team. Never reuse another project's free database or switch to a paid plan automatically. Postiz uses ioredis over TCP/TLS. The Vercel launcher maps Marketplace `KV_URL` to a TLS `REDIS_URL` when the latter is unset, so the secret need not be copied out of Vercel. An explicit connection must use `rediss://`; a REST URL/token is not a replacement.

Keep credentials in Vercel Secret variables under server-only names, scoped to production. Never put private credentials under `NEXT_PUBLIC_*`. Backend setup needs `DATABASE_URL`, `DIRECT_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Supabase S3 credentials/region/bucket, unique `JWT_SECRET` and `ENCRYPTION_KEY`, `REDIS_URL`, and `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_API_KEY`, `TEMPORAL_TLS=true`. Configure SMTP before client invitations or report delivery.

Prisma needs a direct or session-pooler connection to Mireva with `?schema=postiz`; transaction pooling remains unvalidated. Limit per-instance connections and validate Vercel concurrency. Run the checked-in Prisma migrations from a trusted operator environment; do not replace them with `db push` or expose `postiz` through Supabase's Data API.

Mireva uses the dashboard-confirmed shared session pooler `aws-1-us-west-2.pooler.supabase.com:5432` with role `mireva_app.ggvmlijdzhmeqkgsgepc`, strict certificate validation, and a two-connection client pool. Credentials are private. The role has no superuser, role/database creation, replication, RLS bypass or inherited privileges, and is limited to 20 server connections. Database `CREATE` permission was granted only while Prisma ran and revoked afterward. For future migrations, grant/revoke that permission through the project operator in a `finally` path; ordinary API operation must not retain it. Back up/recreate the role before restoring schema dumps that name it as owner.

Supabase's pooler uses a private CA. The container trusts the [public Supabase CA](../../deploy/certs/README.md) for both Prisma/OpenSSL and Node/Postgres. Operator-side Prisma commands must supply that certificate through their connection's `sslcert` parameter; never disable certificate verification. This changes only the application container's trust store.

Set `PORT=3000` in Mireva's project environment so Vercel container ingress matches NestJS, plus `VERCEL_SERVICES=true`, `AUTH_PROVIDER=supabase`, `STORAGE_PROVIDER=supabase`, `ENCRYPTION_PROVIDER=local`, `DEPLOYMENT_ENVIRONMENT=production`, `FRONTEND_URL=https://mireva.live`, `MAIN_URL=https://mireva.live`, `PUBLIC_BACKEND_URL=https://mireva.live/api/backend`, and `NEXT_PUBLIC_BACKEND_URL=/api/backend`. Leave the frontend binding to Vercel. Start `PUBLISHING_ENABLED`, `ENGAGEMENT_ENABLED`, `ADS_WRITES_ENABLED`, `RUN_AGENCY_SYNC` and `RUN_CRON` false, with `WORKER_ACTIVITY_CONCURRENCY=2`.

The Vercel entrypoint rejects missing managed dependencies and plaintext connections before NestJS starts. Preview APIs additionally require an isolated staging configuration and all job/write flags false. Preview workers are prohibited. Keep previews disabled until separate staging Supabase, Redis and Temporal credentials are supplied.

The final Linux image passed API startup, Supabase identity verification and matching source download under 1.25 CPU / 1536 MiB limits, using about 647 MiB while idle. Prisma and Node/Postgres both connected to Mireva's hosted pooler with certificate validation after database `CREATE` was revoked. Signed private-object delivery and rejection of public/unauthenticated reads were verified. The approved S3 credentials also passed presigned PUT, HEAD/byte-range probing, sealed copying and signed download; all temporary QA objects were removed. An application-schema export restored into an isolated PostgreSQL 17 container with all 111 tables and six migrations. These checks do not certify production capacity, full disaster recovery or managed Temporal/Redis access.

## Costs and capacity

The current team is Hobby. Its 420 GB-hour monthly daemon memory quota is shared across projects; a continuous 2 GiB worker reaches it in about nine days. Exhausting a Hobby quota stops all daemons in that team. Keep Mireva's worker at zero instances. Do not upgrade this shared team, transfer a project or activate workers without the owner's explicit hosting/billing decision. See [daemon limits](https://vercel.com/docs/daemons/limits).

[Vercel Pro](https://vercel.com/pricing) starts at US$20/month plus applicable usage, with US$20 of included usage credit. Daemon CPU/memory, API compute, transfers and builds can add costs. The owner requested a separate Mireva-only Pro team. Its checkout is prepared for review: US$20 charged immediately, monthly renewal plus taxes/usage and the applicable Flat Rate CDN tier. Payment and team creation await the owner; no existing team has been upgraded. After creation, review and transfer only Mireva before provisioning Redis in the destination team.

[Temporal Cloud's direct offer](https://temporal.io/pricing) currently includes US$150 credits for 90 days, then usage pricing from US$50/million actions, storage charges and Developer support at 10% of usage, without a base monthly fee. The owner created the Temporal account; its dashboard shows US$150 trial credits expiring in 90 days. Verify the actual billing arrangement before paid activation. Redis Free remains subject to its limits. No paid Redis plan, Vercel upgrade or SMTP subscription has been activated here.

## Release

1. Rehearse migrations, private storage, invitations/recovery and the source/image build in staging. Run the existing release gates in `runbook.md`.
2. Change only Mireva's project root to `.` and clear frontend framework/build/install/output overrides so root `vercel.json` owns Services configuration. Keep the Git build hold until dependencies are ready.
3. Build a production deployment without assigning `mireva.live`, with worker count zero and live flags false. Verify actual Auth, API, media, reports and matching source download.
4. Bootstrap the owner when SMTP/templates and invitation links work, and verify backend `SUPERADMIN` membership.
5. Promote the tested deployment and attach the domain after checking its existing routing. Never move a domain from another project automatically.
6. After the plan, managed namespace and capacity/recovery tests are resolved, scale only Mireva's `publisher` to one instance. Activate writes one verified network at a time.

Roll back Services together and retain old Temporal workflow versions while their executions remain open. Daemon restarts must preserve approvals, histories and delivery reconciliation.

For local image QA, set `AGENCY_TEST_IMAGE=mireva-vercel:20261119`, `AGENCY_TEST_VERCEL_IMAGE=true`, and `AGENCY_TEST_SOURCE_ARCHIVE` to the archive extracted from that image, then run `pnpm agency:test:image`. The script requires the dedicated localhost Supabase/database fixture, disables all jobs, and uses the Compose launcher to connect to local non-TLS dependencies. Test the Vercel launcher's TLS/configuration rejection separately. Local QA does not verify Vercel ingress/bindings or managed-provider access.
