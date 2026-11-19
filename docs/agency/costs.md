# Operating costs and paid activation

Checked 2026-11-19. No paid service, license, advertising campaign, or developer API subscription was activated by preparing this inventory. Prices can change; verify the provider's current checkout or written quote before activation. Listed currency is USD where a numeric price is shown. Taxes, CAD conversion, discounts, existing account credits, and negotiated terms are excluded.

## Core deployment

| Dependency | Current public pricing reference | Cost driver | Activation state |
| --- | --- | --- | --- |
| Supabase | [Pricing](https://supabase.com/pricing): Pro starts at $25/month; the first project is included and additional projects start at $10/month | Project compute, database disk, Auth usage, private storage, egress, backups, and a separate staging project | Existing Free project configured; no upgrade |
| Vercel | [Pricing](https://vercel.com/pricing): existing Pro team reused; no new subscription or deploying seat for Mireva | Shared credit, API/function compute, daemon memory/CPU, network usage, builds, and preview/staging needs | Project configured; builds held and worker at zero |
| Redis | [Upstash pricing](https://upstash.com/pricing/redis): dedicated Free plan selected | Free quotas; approval required before any paid plan or automatic upgrade | Mireva production resource ready; paid upgrades disabled |
| Temporal Cloud | [Pricing](https://temporal.io/pricing): current direct trial includes $150 credits for 90 days; later usage/support/storage charges apply | Workflow actions and retained history; verify the account's actual purchasing arrangement | Namespace and scoped key configured under the owner's trial; workers paused |
| Supporting Linux host | Alternative Compose deployment only; no separate host selected for the current Vercel architecture | Compute, persistent storage, backups, network transfer, and monitoring if that alternative is later selected | Not provisioned |
| Transactional email/SMTP | [Resend pricing](https://resend.com/pricing), or the agency's configured SMTP contract | Invitations, password recovery, publishing notifications, and report email volume | Not activated |
| Domain and backups | `mireva.live` selected; use its registrar and the chosen backup destination's current price | Domain renewal, DNS choices, retained backup size, restore testing, and off-host copies | Production routing/off-host backup destination pending |

The Supabase and Vercel headline amounts are not a complete platform estimate. Do not label their sum as the monthly operating cost: staging, server resources, media egress, email, and licensed/API capabilities are additional variables.

An existing Pro subscription does not make an always-on worker free. A 2 GiB worker uses 1,440 GiB-hours in a 30-day month; the current Mireva `sfo1` review estimates $42.34 for memory alone, plus active CPU and other services, before available shared credits and taxes. Verify the regional rates before activation. Keep account-specific invoices and consumption in private operator records. Do not change the shared team's budget or add-ons to enforce a Mireva limit, because those controls may affect the owner's other projects.

## Licensed and metered capabilities

| Dependency/capability | Official price reference | Charging basis or required quote | Activation state |
| --- | --- | --- | --- |
| Embedded Polotno editor | [Polotno SDK pricing](https://polotno.com/sdk/pricing) | Commercial license quote based on the product's scope and volume; monthly or annual terms. Do not reuse an old fixed-price assumption | License not obtained |
| AI captions, analysis, and image/video generation | [OpenAI API pricing](https://openai.com/api/pricing/) and the selected additional model vendors' price sheets | Model-specific tokens, images, output duration, tool calls, and generated-media volume | Keys/budget not configured |
| Video processing and clipping | [RunPod pricing](https://www.runpod.io/pricing) and [serverless product](https://www.runpod.io/product/serverless) | CPU/GPU worker execution time, worker configuration, storage, and network transfer | Endpoints not deployed |
| Speech transcription | [Deepgram pricing](https://deepgram.com/pricing) | Selected model and processed audio duration | Not activated |
| YouTube media ingestion used by the inherited clipping worker | [Oxylabs pricing](https://oxylabs.io/pricing) | Confirm the correct video data product and its current usage rate or sales quote; do not substitute an unrelated proxy price | Not activated |
| Farcaster service dependency | [Neynar developer offering](https://neynar.com/developer) | Confirm the API plan and any signer sponsorship charges in the account's current offering | Not activated |
| X API | [Current X API pricing](https://docs.x.com/x-api/getting-started/pricing) | Usage credits and endpoint-specific charges; inspect configured account limits and available analytics access | Not activated |
| Other social-network APIs | Provider's current developer portal and granted product | Approved scopes, usage quotas, account entitlements, and any commercial access agreement | No developer apps yet |
| Meta, Google, and TikTok advertising | The connected advertising accounts' billing arrangements | Campaign media spend is separate from hosting/API cost; actual campaign budgets and results belong to each brand | No campaigns activated |
| Canva, Adobe Express, Google Drive, and Looker Studio integration | Selected vendor's current developer/product terms | Existing subscriptions, integration approval, asset access, and any metered features | Integrations not activated |

The [inherited clipping setup](https://docs.postiz.com/self-host/configuration/clipping) uses RunPod, Oxylabs, Deepgram, and OpenAI. Its baseline media path assumes Cloudflare R2; the approved implementation replaces that storage assumption with verified Supabase capabilities. Do not add an R2 subscription merely to avoid testing the Supabase adapter.

## Estimate before enabling a capability

Record the following in the deployment's cost worksheet before adding paid credentials or enabling a licensed feature:

1. Provider, selected product/plan/model, currency, billing interval, and dated price/quote link.
2. Separate staging and production fixed charges, including host backups and any additional project compute.
3. Expected monthly posts, media sizes and transfers, analytics polling, inbox events, report generation, emails, AI requests, and video minutes.
4. Included allowance, marginal rate, expected usage cost, available account credits, and a high-usage scenario.
5. Provider-side budget/spend limits, application quotas, and alerts where available.
6. Agency owner responsible for the account, documented activation decision, and the date the cost was verified.

A complete estimate is the sum of selected fixed contracts plus usage at the verified rates, with advertising media budgets shown separately. No total is supplied here because provider accounts, workloads, host vendor, and the editor license quote are not yet established.
