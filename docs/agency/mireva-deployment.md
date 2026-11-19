# Mireva deployment targets

These targets identify the intended deployment. Git publication is the first step; production publishing remains disabled until infrastructure and live verification are complete.

| Setting | Target |
| --- | --- |
| Source repository | `https://github.com/LaurentBerier/mireva.live.git` |
| Production frontend domain | `https://mireva.live` |
| Vercel project name | `mireva-live` |
| Vercel project ID | `prj_evuirQBuWEDT5yjrwFMiwsnpC7Eg` |
| Vercel team | Sandscape-BW (`sanscape-breakingwalls`, `team_U9WWpAPb1qiHoLZfKlWMHwDo`) |
| Selected Vercel target | Repository root (`.`), using Services |
| Supabase project reference | `ggvmlijdzhmeqkgsgepc` |
| Supabase API URL | `https://ggvmlijdzhmeqkgsgepc.supabase.co` |
| Initial agency | Mireva |
| Owner role | `SUPERADMIN`, assigned through `AGENCY_OWNER_EMAIL` during bootstrap |
| Initial brand timezone | `America/Toronto` |
| API host | Vercel container service, pending activation |
| Publishing worker | Vercel Daemon, configured at zero instances |
| Temporal | `mireva-production.yb05k` active; scoped API key and TLS connection verified |
| Redis | `mireva-production-redis`, Upstash Free, connected only to Mireva production; TLS verified |
| Staging project and backend | Pending selection |

Keep the owner's email and all credentials in private deployment environment configuration. Set `AGENCY_OWNER_EMAIL` to the owner's supplied address, `AGENCY_NAME=Mireva`, and `AGENCY_FIRST_BRAND=Mireva` before running remote bootstrap. Bootstrap grants the owner `SUPERADMIN` agency and brand memberships and sends a Supabase Auth invitation.

The Supabase URL/project reference is public configuration, not a service-role key or database password. Obtain the project's public publishable key for the frontend. Backend deployment additionally needs its private database, service-role, S3 and encryption credentials. Inspect the existing project schema before applying migrations.

The user selected Vercel Services and Daemons with managed Temporal and Redis on November 19, 2026, then selected the existing Sandscape Pro team's `mireva-live` project. See the [Vercel release guide](vercel.md). The new project's automatic import failed with a missing root `.next` directory. Its settings now use the repository root for Services, Node 22 and cleared framework/build overrides; Git builds and previews remain held. No production deployment is ready. The original `apps/frontend/vercel.json` remains available for the separate-host deployment.

Use `VERCEL_SERVICES=true`, `FRONTEND_URL` and `MAIN_URL=https://mireva.live`, `NEXT_PUBLIC_BACKEND_URL=/api/backend`, and `PUBLIC_BACKEND_URL=https://mireva.live/api/backend`. Services supplies the frontend's `BACKEND_INTERNAL_URL` binding at runtime; do not manually overwrite it.

Mireva's public Supabase URL/key, API port, Temporal endpoint/namespace, nine server-only Secrets and managed Redis variables are configured only in Vercel production. Hosted Auth public signups are disabled, email confirmations remain required, the site URL is `https://mireva.live`, and the exact callback is `https://mireva.live/auth/callback`. All six Prisma migrations are applied in the private `postiz` schema. The dedicated `mireva_app` login owns `postiz` and `postiz_memory` and has no schema-creation/admin privileges at runtime. Browser roles have no schema/table access. Data API rejection and security advisors were checked. The private `agency-media` bucket is created with a 50 MiB upload limit under the current Free plan. The approved S3 key passed presigned upload, range probing, sealing and signed download checks. Owner invitation, SMTP and custom email templates remain pending. The dashboard requires custom SMTP or a suitable Supabase plan to edit templates; neither has been activated here.

The selected team is already Pro. No additional team subscription, member or paid add-on was created. Included credit and daemon capacity are shared with its other projects. Reusing the team does not guarantee zero extra compute/transfer/build charges; the worker remains at zero instances until a usage budget is approved. Do not change team-wide billing or pause other projects.

Keep `PUBLISHING_ENABLED`, `ENGAGEMENT_ENABLED`, `ADS_WRITES_ENABLED` and `RUN_AGENCY_SYNC` false during setup. Vercel previews require an explicit staging backend and staging Supabase configuration. Do not attach preview workers or credentials to the production publishing environment.

Follow the [release runbook](runbook.md) for DNS/TLS, Auth callbacks, SMTP, storage, migrations, bootstrap, backup restoration and activation checks. The repository's build workflow uses a disposable PostgreSQL service and test-only configuration; it has no production credentials and performs no deployment. Upstream container/extension publishing and staging automation jobs are restricted to the upstream Postiz repository.
