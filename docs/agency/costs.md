# Operating costs and paid activation

Checked 2026-11-19. No paid service, license, advertising campaign, or developer API subscription was activated by preparing this inventory. Prices can change; verify the provider's current checkout or written quote before activation. Listed currency is USD where a numeric price is shown. Taxes, CAD conversion, discounts, existing account credits, and negotiated terms are excluded.

## Core deployment

| Dependency | Current public pricing reference | Cost driver | Activation state |
| --- | --- | --- | --- |
| Supabase | [Pricing](https://supabase.com/pricing): Pro starts at $25/month; the first project is included and additional projects start at $10/month | Project compute, database disk, Auth usage, private storage, egress, backups, and a separate staging project | Not activated |
| Vercel | [Pricing](https://vercel.com/pricing): Pro is listed at $20/month before metered usage and account-specific billing details | Deployment plan, team access, functions, network usage, builds, logs, and preview/staging needs | Not activated |
| Supporting Linux host | Provider not selected; obtain the selected host's published price/quote for the approved 4-vCPU/8-GB starting specification | Compute, persistent disk for Temporal, Redis, backup storage, network transfer, and monitoring | Not provisioned |
| Redis and Temporal | Self-hosted services in the supporting-host deployment; no hosted-service subscription assumed | Their resource use is part of host sizing, persistence, and operations | Not activated |
| Transactional email/SMTP | [Resend pricing](https://resend.com/pricing), or the agency's configured SMTP contract | Invitations, password recovery, publishing notifications, and report email volume | Not activated |
| Domain and backups | Use the selected registrar and backup destination's current price | Domain renewal, DNS choices, retained backup size, restore testing, and off-host copies | Not selected |

The Supabase and Vercel headline amounts are not a complete platform estimate. Do not label their sum as the monthly operating cost: staging, server resources, media egress, email, and licensed/API capabilities are additional variables.

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
