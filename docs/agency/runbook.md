# Staging, release and recovery

Mireva's selected deployment is [Vercel Services with managed Temporal and Redis](vercel.md). The supporting-stack commands below describe the alternative Docker Compose host. Use the selected guide for project settings, container/Daemon deployment, managed-provider credentials and current activation blockers; the validation and recovery requirements here still apply.

## Accounts and domains

Use separate Supabase projects, backend Compose stacks/volumes, Temporal namespaces and Vercel environments for staging and production. Initial host specification is 4 vCPU / 8 GB RAM; the provided limits leave room for the host but are not a completed capacity test. Build images in CI or on a larger build machine rather than competing with workers on the production host.

Set a real API hostname in `API_DOMAIN` and point DNS at the supporting Linux host. Caddy terminates HTTPS on ports 80/443. Redis, Temporal and its database have no published production ports. Keep access to their administrative interfaces behind host authentication. Do not share staging database/Redis/Temporal credentials with production.

Supabase configuration:

1. Disable public signup. Enable email authentication, confirmations and a configured SMTP provider. Set site URL to the canonical frontend. Add exact invitation/recovery callback URLs `/auth/callback` for the intended environment; previews need explicitly permitted staging callback origins.
2. Keep exposed Data API schemas to `public, graphql_public`; do not expose `postiz` or `postiz_memory`. Do not grant browser roles direct access to application tables.
3. Set the `agency-media` bucket private with the MIME allowlist in the bootstrap script. Use a file limit supported by the project's plan: Mireva currently has a 50 MiB bucket limit under Free; the bootstrap's 1 GiB default requires a suitable plan/global limit or an existing correctly configured bucket. Enable S3 access and use server-only S3 credentials. Do not create public storage policies for uploaded objects.
4. Install the invite and recovery templates from `supabase/templates/`. Confirm the generated link uses the frontend callback with `token_hash` and the proper `type`. Verify actual delivery and expired-link behavior in staging.
5. Supply direct/session PostgreSQL URLs in `DATABASE_URL` and `DIRECT_DATABASE_URL`, each with `?schema=postiz`. Migrations require a suitable database role; runtime credentials should follow the organization's database access policy.

Vercel project root: `apps/frontend`. Use its checked-in `vercel.json`. Set Node 22 and the pinned pnpm package manager; allow access to the monorepo root during installation. Set only frontend/server session variables there: `AUTH_PROVIDER=supabase`, `IS_GENERAL=true`, `DISABLE_REGISTRATION=true`, `FRONTEND_URL`, `MAIN_URL`, `NEXT_PUBLIC_BACKEND_URL=/api/backend`, `BACKEND_INTERNAL_URL`, Supabase public URL/publishable key and optional public editor/AI flags. Social credentials, Supabase service/S3 keys, encryption keys and database secrets belong on the supporting host.

For Vercel Preview set `STAGING_BACKEND_INTERNAL_URL` and **staging** Supabase public variables. A preview build fails without an explicit staging backend. Use an isolated staging host with live-write flags false. Preview deployments cannot host workers. Verify same-origin private media and Auth callbacks on an actual preview hostname before release.

## Prepare and start the supporting stack

Copy `.env.agency.example` into a private `.env` on the host. Replace all placeholders, localhost endpoints and local passwords. Set `FRONTEND_URL` to the canonical frontend, `PUBLIC_BACKEND_URL` to the HTTPS API, the intended `DEPLOYMENT_ENVIRONMENT`, an immutable `RELEASE_TAG`, `TEMPORAL_NAMESPACE`, and a unique `TEMPORAL_DB_PASSWORD`. Do not reuse encryption/session secrets across environments. Retain the encryption key for restores.

From the fork checkout, with pinned dependencies and the desired reviewed source revision:

```sh
pnpm agency:source
docker compose -f deploy/docker-compose.production.yml build backend
docker compose -f deploy/docker-compose.production.yml up -d redis temporal-db temporal
docker compose -f deploy/docker-compose.production.yml run --rm migrate
docker compose -f deploy/docker-compose.production.yml run --rm prepare
docker compose -f deploy/docker-compose.production.yml run --rm bootstrap
docker compose -f deploy/docker-compose.production.yml up -d backend orchestrator gateway
docker compose -f deploy/docker-compose.production.yml ps
```

Bootstrap is idempotent and invites the owner. Do not use `--local` remotely. The source archive is excluded from Git; regenerate it for each release and retain the matching image digest, source checksum, Vercel deployment and migration version. The image extracts/compiles that archive and serves it at `/agency-public/source`. All upstream license notices remain included.

Health endpoints: API `/agency-public/health` checks application database access; worker `/health/status` checks its Temporal namespace. Worker health does not replace publish/sync monitoring. The Agency overview displays failed publications, overdue jobs/reports, disconnected profiles, uncertain deliveries and recent sync results. Add external uptime checks and alerts to the agency's chosen monitoring service; that service is not provisioned by this checkout.

## Activation and release gates

Start with all write flags false. Register apps and document approved permissions and costs using the inventory. Activate one credentialed network at a time; no network is excluded from scope because another is easier to register. TikTok Direct Post has eligibility restrictions for internal-only tools: use an approved upload/manual workflow until the product/access model is accepted.

Before launch:

1. Run local automated checks and staging staff/client page/API/media/report/automation-credential isolation checks. Exercise invites, password recovery, token expiry and role revocation in a real browser.
2. Run full provider contract fixtures and a native live smoke test for every activated provider/format, including extension/API-only connections. Check scope rejection, throttling, refresh/reconnect and native result IDs. Keep failed/pending statuses visible.
3. Exercise request/approve/change/cancel, simultaneous edits, media and destination changes, API/MCP automation and the final worker approval gate. Test Toronto DST transitions and worker restarts with repeating schedules.
4. Induce partial threads, accepted-but-pending uploads, activity timeouts and worker interruption. Never assume a provider exception means nothing published. Reconcile uncertain attempts against the native platform before an administrator records PUBLISHED/NOT_PUBLISHED and evidence. The UI enforces the activity timeout plus safety margin before this operation.
5. Reconcile analytics against native dashboards, inbox deduplication against actual webhooks/polling, keyword triggers against eligible messages, SmartLink click tracking, website registered origins and report downloads/rendering/delivery. Unavailable metrics must remain unavailable.
6. Restore the complete staging system and roll back a deployment as described below. Run target-host concurrency/load tests with up to ten representative brands and media sizes; monitor RSS, CPU, event-loop lag, memory, API latency, Temporal queue latency and overdue publications. Do not enable production publishing until capacity and alerts are verified.

## Backups

Use the selected Supabase plan's managed database backups/PITR and regularly export the application schema. Supabase database backups contain Storage metadata, **not object bytes** ([official documentation](https://supabase.com/docs/guides/platform/backups)). Keep versioned encrypted copies of private object bytes through an S3 backup tool, and verify checksums. Capture Auth users/config/templates and project configuration using supported Supabase backup/migration workflows; restoring only `postiz` cannot restore logins.

For self-hosted Temporal, back up both databases (`temporal` and `temporal_visibility`) with PostgreSQL-compatible logical backups or coordinated disk snapshots. For managed Temporal Cloud, verify the provider's retention/recovery controls and document the namespace, workflow histories and search attributes; the self-hosted database dump procedure does not apply. Keep Redis AOF snapshots where supported, `.env`/encryption keys in the secret manager, the immutable application image/source and exact deployment configuration. Store backup copies off the host with access controls and retention appropriate to agency/client records. This repository does not provision a backup vendor or schedule unattended backups.

For the staging disaster recovery drill, disable publishing, engagement, ad writes and maintenance. Restore the Supabase database/Auth configuration and private media into an isolated project, then restore both Temporal databases into an isolated stack. Restore encryption keys from the secret manager. Start the matching image; confirm users/memberships, approvals, media checksums, reports and native metric histories. Verify Temporal namespaces, execution histories, search attributes and queued schedules before workers are enabled. Reconcile any workflow that was in flight at the backup boundary against the native network. Never run restored workflows against production accounts until duplicates and schedules have been reconciled.

The local restore scripts validate the app schema, a private object and both Temporal databases in isolated containers. Preserve the original Temporal database names: schema-version records include those names. Hosted Auth/PITR, full-bucket restore, complete environment recovery, RPO/RTO and an off-host restoration remain open release gates. Record the operator, backup timestamps, checksums, restore duration and evidence.

## Rollback

Keep the previous backend/worker image tag and Vercel deployment. Pause new scheduling and disable live writes before a rollback; wait for activities or reconcile uncertain outcomes. Redeploy the previous immutable image and compatible frontend deployment, then verify health and selected read-only checks. New workflow names retain old workflow code; never remove an existing version while its executions are open.

Do not blindly reverse a schema migration or restore an old database over newer publish results. This initial schema is for a fresh agency installation; migrating a populated upstream database needs a separately rehearsed import/migration. Prefer additive compatible migrations. If database rollback is unavoidable, perform a controlled restore with application downtime and reconcile native publishes since the backup. Record that decision and restore evidence before resuming writes.
