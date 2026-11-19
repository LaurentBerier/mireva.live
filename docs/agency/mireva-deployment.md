# Mireva deployment targets

These targets identify the intended deployment. Git publication is the first step; production publishing remains disabled until infrastructure and live verification are complete.

| Setting | Target |
| --- | --- |
| Source repository | `https://github.com/LaurentBerier/mireva.live.git` |
| Production frontend domain | `https://mireva.live` |
| Vercel project name | `mireva` |
| Vercel project root | `apps/frontend` |
| Supabase project reference | `ggvmlijdzhmeqkgsgepc` |
| Supabase API URL | `https://ggvmlijdzhmeqkgsgepc.supabase.co` |
| Initial agency | Mireva |
| Owner role | `SUPERADMIN`, assigned through `AGENCY_OWNER_EMAIL` during bootstrap |
| Initial brand timezone | `America/Toronto` |
| Supporting backend/worker host | Pending selection |
| Staging project and backend | Pending selection |

Keep the owner's email and all credentials in private deployment environment configuration. Set `AGENCY_OWNER_EMAIL` to the owner's supplied address, `AGENCY_NAME=Mireva`, and `AGENCY_FIRST_BRAND=Mireva` before running remote bootstrap. Bootstrap grants the owner `SUPERADMIN` agency and brand memberships and sends a Supabase Auth invitation.

The Supabase URL/project reference is public configuration, not a service-role key or database password. Obtain the project's public publishable key for the frontend. Backend deployment additionally needs its private database, service-role, S3 and encryption credentials. Inspect the existing project schema before applying migrations.

The Vercel project must use the checked-in `apps/frontend/vercel.json`, allow installation from the monorepo root, and use Node 22. Set `FRONTEND_URL` and `MAIN_URL` to `https://mireva.live`, and `NEXT_PUBLIC_BACKEND_URL=/api/backend`. Set `BACKEND_INTERNAL_URL` and `PUBLIC_BACKEND_URL` once the supporting host and its HTTPS endpoint are configured; the NestJS API and Temporal workers require that supporting host.

Keep `PUBLISHING_ENABLED`, `ENGAGEMENT_ENABLED`, `ADS_WRITES_ENABLED` and `RUN_AGENCY_SYNC` false during setup. Vercel previews require an explicit staging backend and staging Supabase configuration. Do not attach preview workers or credentials to the production publishing environment.

Follow the [release runbook](runbook.md) for DNS/TLS, Auth callbacks, SMTP, storage, migrations, bootstrap, backup restoration and activation checks. The repository's build workflow uses a disposable PostgreSQL service and test-only configuration; it has no production credentials and performs no deployment. Upstream container/extension publishing and staging automation jobs are restricted to the upstream Postiz repository.
