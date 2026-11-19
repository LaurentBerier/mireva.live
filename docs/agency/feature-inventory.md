# Feature and network inventory

Baseline: Postiz `2f24e10f2204295f66a1999679e9896db3cb2094`, captured 2026-11-19. This is source evidence, not a production-readiness claim. Update independent status fields only when verification evidence exists.

## Status interpretation

`inherited_unverified` means source exists. `planned` means implementation or equivalence work remains. Credentials, platform approval, and live verification are independent. Deployment credentials begin unconfigured; no developer-app reviews have been submitted.

## Delivery capabilities

| Phase | Capability | Baseline implementation |
| --- | --- | --- |
| 1 | Vercel frontend and Docker backend/orchestrator | `planned` |
| 1 | Supabase invitations, sessions and password recovery | `planned` |
| 1 | Private application schema and Prisma migrations | `planned` |
| 1 | Private media, resumable uploads and signed delivery | `planned` |
| 1 | Agency administration and brand organizations | `planned` |
| 1 | Staff membership and client-reviewer permissions | `planned` |
| 1 | Versioned approval gates at scheduling and delivery | `planned` |
| 1 | Separate implementation, credentials, approval and live status | `planned` |
| 2 | Day/week/month/list calendar | `inherited_unverified` |
| 2 | Shared copy and per-channel variants | `inherited_unverified` |
| 2 | Post and channel previews | `inherited_unverified` |
| 2 | Draft, immediate, scheduled and repeating posts | `inherited_unverified` |
| 2 | Threads, first comments and delays | `inherited_unverified` |
| 2 | Searchable uploaded media library | `inherited_unverified` |
| 2 | Sets, signatures and channel selections | `inherited_unverified` |
| 2 | RSS-triggered content generation | `inherited_unverified` |
| 2 | Milestone-triggered Postiz plugs | `inherited_unverified` |
| 2 | Publication webhooks | `inherited_unverified` |
| 2 | Publishing and channel-management API | `inherited_unverified` |
| 2 | CLI/MCP and AI-agent integration surfaces | `inherited_unverified` |
| 2 | Publishing notifications and connection refresh | `inherited_unverified` |
| 2 | Bulk scheduling and CSV imports | `planned` |
| 2 | Automated reusable content queues | `planned` |
| 2 | Saved posts and reusable templates | `planned` |
| 3 | Existing provider-native account and post analytics | `inherited_unverified` |
| 3 | Historical metric storage and period comparisons | `planned` |
| 3 | Audience and format performance analysis | `planned` |
| 3 | Hashtag discovery and performance analysis | `planned` |
| 3 | Competitor tracking and benchmarking | `planned` |
| 3 | Best publishing times from available history | `planned` |
| 3 | Organic and paid campaign dashboards | `planned` |
| 3 | Website/blog tracking and real-time traffic | `planned` |
| 3 | Branded PDF/PowerPoint reports and CSV exports | `planned` |
| 3 | Scheduled reports and email delivery | `planned` |
| 3 | Reusable brand report templates | `planned` |
| 3 | AI-assisted reporting and analysis | `planned` |
| 3 | Shareable reports and live dashboard links | `planned` |
| 3 | Looker Studio connector | `planned` |
| 4 | Unified direct-message and comments inbox | `planned` |
| 4 | Replies through supported channels | `planned` |
| 4 | Conversation assignments, notes and status | `planned` |
| 4 | Reusable reply snippets | `planned` |
| 4 | Keyword-triggered comment and DM flows | `planned` |
| 4 | Flow execution history and results | `planned` |
| 5 | Branded link-in-bio pages | `planned` |
| 5 | Link click and click-through analytics | `planned` |
| 5 | Meta Ads reporting and campaign management | `planned` |
| 5 | Google Ads reporting and campaign management | `planned` |
| 5 | TikTok Ads reporting and campaign management | `planned` |
| 5 | Canva/Adobe Express and external media workflows | `planned` |
| 5 | Licensed Polotno visual editor | `inherited_unverified` |
| 5 | AI text, images and video generation | `inherited_unverified` |
| 5 | Video clipping and captioned outputs | `inherited_unverified` |
| 5 | Third-party generated media ingestion | `inherited_unverified` |

## Provider inventory

The pinned registry has **35 active identifiers**. The [public guide](https://docs.postiz.com/general/platforms/overview) says 34. Separate connection variants are counted separately here. The additional `mastodon-custom` source variant is disabled in the registry.

| Identifier | Connection | Registered | Benchmark coverage | Live verification |
| --- | --- | --- | --- | --- |
| `bluesky` | credentials | Yes | postiz, metricool | Not verified |
| `devto` | credentials | Yes | postiz | Not verified |
| `discord` | oauth | Yes | postiz | Not verified |
| `dribbble` | oauth | Yes | postiz | Not verified |
| `facebook` | oauth | Yes | postiz, metricool | Not verified |
| `wrapcast` | in_app | Yes | postiz | Not verified |
| `gmb` | oauth | Yes | postiz, metricool | Not verified |
| `hashnode` | credentials | Yes | postiz | Not verified |
| `instagram` | oauth | Yes | postiz, metricool | Not verified |
| `instagram-standalone` | oauth | Yes | postiz, metricool | Not verified |
| `kick` | oauth | Yes | postiz | Not verified |
| `lemmy` | credentials | Yes | postiz | Not verified |
| `linkedin-page` | oauth | Yes | postiz, metricool | Not verified |
| `linkedin` | oauth | Yes | postiz, metricool | Not verified |
| `listmonk` | credentials | Yes | postiz | Not verified |
| `mastodon-custom` | oauth | No | postiz | Not verified |
| `mastodon` | oauth | Yes | postiz | Not verified |
| `medium` | credentials | Yes | postiz | Not verified |
| `mewe` | oauth | Yes | postiz | Not verified |
| `moltbook` | in_app | Yes | postiz | Not verified |
| `nostr` | credentials | Yes | postiz | Not verified |
| `pinterest` | oauth | Yes | postiz, metricool | Not verified |
| `reddit` | oauth | Yes | postiz | Not verified |
| `skool` | browser_extension | Yes | postiz | Not verified |
| `slack` | oauth | Yes | postiz | Not verified |
| `telegram` | in_app | Yes | postiz | Not verified |
| `threads` | oauth | Yes | postiz, metricool | Not verified |
| `tiktok-business` | oauth | Yes | postiz, metricool | Not verified |
| `tiktok` | oauth | Yes | postiz, metricool | Not verified |
| `tumblr` | oauth | Yes | postiz | Not verified |
| `twitch` | oauth | Yes | postiz, metricool | Not verified |
| `vk` | oauth | Yes | postiz | Not verified |
| `whop` | oauth | Yes | postiz | Not verified |
| `wordpress` | credentials | Yes | postiz | Not verified |
| `x` | oauth | Yes | postiz, metricool | Not verified |
| `youtube` | oauth | Yes | postiz, metricool | Not verified |

Advertising, website tracking, Looker Studio, Canva, Adobe Express, and Google Drive are separate integrations, not inherited publishing adapters. Their baseline implementation is planned.

## Scope and readiness

Initial capacity is ten brands with staff and client accounts. Each brand is an organization. Approval is required by default and configurable per brand. Every targeted network remains in scope and activates progressively. Delivery covers responsive web workflows; native mobile apps and subscription billing are excluded.

Analytics methods are declared on only some adapters, and their available metrics differ. Method declarations in the JSON are source evidence only. Provider permissions, media rules, actual results, API-only access, and browser-extension connections all require verification.

## Sources

- [Pinned provider registry](https://github.com/gitroomhq/postiz-app/blob/2f24e10f2204295f66a1999679e9896db3cb2094/libraries/nestjs-libraries/src/integrations/integration.manager.ts)
- [Postiz platform rules](https://docs.postiz.com/general/platforms/overview)
- [Postiz provider setup](https://docs.postiz.com/self-host/providers/overview)
- [Postiz product documentation](https://docs.postiz.com/general/introduction)
- [Metricool connections](https://help.metricool.com/how-to-connect-social-media-and-ad-platforms-to-metricool-qrkvn)
- [Metricool planning](https://metricool.com/planner/)
- [Metricool analytics](https://metricool.com/metricoolanalytics/)
- [Metricool reporting](https://metricool.com/customized-social-media-reports/)
- [Metricool inbox](https://metricool.com/social-media-inbox/)
- [Metricool Flows](https://metricool.com/flows/)
- [Metricool SmartLinks](https://metricool.com/socialmedia-smartlinks/)
- [Metricool ads](https://metricool.com/manage-online-campaigns-metricool/)

See [feature-inventory.json](feature-inventory.json) for per-provider configuration names and independent readiness fields. Record deployment-specific activation evidence without treating inherited code as verified behavior.

## Current implementation checkpoint

This checkpoint distinguishes working local modules from complete product parity. No developer app, social credential, advertising account or paid AI/editor service has been activated.

| Phase | Capability | Current implementation | Coverage and remaining work |
| --- | --- | --- | --- |
| 1 | Vercel frontend and Docker backend/orchestrator | `partial` | Independent Next.js/Vercel configuration, source-based Docker image and supporting Compose prepared. Cloud deployment and host capacity validation pending. |
| 1 | Supabase invitations, sessions and password recovery | `implemented_local` | Invitation-only email identities, confirmed server-verified sessions, recovery callback, owner bootstrap and role-independent identity mapping. Hosted SMTP/domain validation pending. |
| 1 | Private application schema and Prisma migrations | `implemented_local` | Prisma multi-schema models and six migrations in the unexposed postiz schema; application restore drill passed locally. |
| 1 | Private media, resumable uploads and signed delivery | `implemented_local` | Private signed TUS uploads, MIME/size validation, immutable sealed objects, tenant-authorized signed downloads and processing/clipping adapters. Paid processing not activated. |
| 1 | Agency administration and brand organizations | `implemented_local` | Agency groups, assigned brand organizations, admin brand creation and Toronto timezone policy. |
| 1 | Staff membership and client-reviewer permissions | `implemented_local` | Staff roles, client-only reviews/reports, invitations and revocation; HTTP tenant isolation tested. |
| 1 | Versioned approval gates at scheduling and delivery | `implemented_local` | Versioned content/media/settings/destination/time snapshots and backend/Temporal publish gates; serialized edits, invalidation and uncertain-delivery reconciliation. |
| 1 | Separate implementation, credentials, approval and live status | `partial` | Connection readiness, provider inventory and separate credentials/approval/live status; no network has live verification. |
| 2 | Day/week/month/list calendar | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 2 | Shared copy and per-channel variants | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 2 | Post and channel previews | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 2 | Draft, immediate, scheduled and repeating posts | `partial` | Inherited scheduling with V113 approval/ledger gates, local DST and recovery tests. Live delivery and full Temporal end-to-end faults pending. |
| 2 | Threads, first comments and delays | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 2 | Searchable uploaded media library | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 2 | Sets, signatures and channel selections | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 2 | RSS-triggered content generation | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 2 | Milestone-triggered Postiz plugs | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 2 | Publication webhooks | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 2 | Publishing and channel-management API | `partial` | REST preserved with brand isolation and approval enforcement. API scheduling rejection checked locally; full contract suite pending. |
| 2 | CLI/MCP and AI-agent integration surfaces | `partial` | Inherited CLI/MCP retained, absolute backend OAuth URLs and current-membership checks adapted; external client smoke tests pending. |
| 2 | Publishing notifications and connection refresh | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 2 | Bulk scheduling and CSV imports | `implemented_local` | Quoted CSV preview, ordered brand-owned media, draft-only commit, deterministic row IDs and leased restart recovery. |
| 2 | Automated reusable content queues | `partial` | Recurring posts and CSV repeat intervals are available; ordered evergreen category queues remain to implement. |
| 2 | Saved posts and reusable templates | `partial` | Inherited sets/signatures are available; a dedicated searchable reusable-post template library remains to implement. |
| 3 | Existing provider-native account and post analytics | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
| 3 | Historical metric storage and period comparisons | `partial` | Native account/post series are persisted with definitions and collection timestamps. Broader metric dictionaries and comparison UI remain. |
| 3 | Audience and format performance analysis | `partial` | Inherited provider-native series are retained; demographic and format analysis needs additional approved adapters and UI. |
| 3 | Hashtag discovery and performance analysis | `partial` | Owned-post hashtag counts are available; network hashtag discovery and benchmark search remain. |
| 3 | Competitor tracking and benchmarking | `partial` | Watchlists plus Bluesky/YouTube public collectors; additional permitted network collectors and broad benchmarking remain. |
| 3 | Best publishing times from available history | `partial` | History-based recommendations require at least five measured posts; per-network statistical validation pending. |
| 3 | Organic and paid campaign dashboards | `partial` | Organic/post summaries and separate ad-account campaign data exist; unified campaign tagging and attribution remain. |
| 3 | Website/blog tracking and real-time traffic | `implemented_local` | First-party beacon, registered-origin checks, daily anonymous visitor hashes, page/referrer totals and a recent visitor view. Production traffic verification pending. |
| 3 | Branded PDF/PowerPoint reports and CSV exports | `implemented_local` | Branded PDF/PowerPoint and formula-safe CSV export, private brand-owned logo and multi-page export QA. |
| 3 | Scheduled reports and email delivery | `partial` | Temporal monthly report snapshots and email workflow implemented; hosted email delivery and restart smoke test pending. |
| 3 | Reusable brand report templates | `partial` | Saved report definitions with branding and rolling periods; richer reusable report layouts remain. |
| 3 | AI-assisted reporting and analysis | `partial` | Responses API summaries from collected measurements with store:false; disabled without a key and no paid calls made. |
| 3 | Shareable reports and live dashboard links | `partial` | Expiring revocable report URLs with live latest measurements and exports; configurable dashboard widgets remain. |
| 3 | Looker Studio connector | `partial` | Read-only revocable brand metric keys plus Apps Script connector source; Apps Script deployment and live Looker verification pending. |
| 4 | Unified direct-message and comments inbox | `partial` | Normalized conversations/messages with deduplication, native adapters for Meta, YouTube, X, LinkedIn comments, Google Business reviews and TikTok Business comments. Other supported message surfaces remain pending. |
| 4 | Replies through supported channels | `partial` | Native comment/DM/review replies with request IDs and uncertain-send status; live permissions and per-network smoke tests pending. |
| 4 | Conversation assignments, notes and status | `partial` | Assigned active staff and conversation state implemented; internal conversation notes remain. |
| 4 | Reusable reply snippets | `implemented_local` | Brand-scoped reusable reply snippets with backend staff authorization. |
| 4 | Keyword-triggered comment and DM flows | `partial` | Keyword comment/DM flows, Unicode word matching, post filters, outbound suppression and idempotent execution claims; advanced branching remains. |
| 4 | Flow execution history and results | `partial` | Execution history and outcome counts implemented; richer conversion/performance attribution remains. |
| 5 | Branded link-in-bio pages | `partial` | Published branded link pages and editable HTTPS destinations; advanced visual layouts and commerce embeds remain. |
| 5 | Link click and click-through analytics | `partial` | Per-link tracked redirects and click totals; impression-based click-through rates and bot filtering remain. |
| 5 | Meta Ads reporting and campaign management | `partial` | Encrypted account setup, performance snapshots, PAUSED traffic campaign creation and campaign status/budget updates. Ad sets, creatives, targeting and token-refresh onboarding remain. |
| 5 | Google Ads reporting and campaign management | `partial` | Cloud-project API onboarding, v26 reporting and PAUSED traffic campaign budgets/status. Ad groups, assets/keywords and full campaign creation parity remain. |
| 5 | TikTok Ads reporting and campaign management | `partial` | Advertiser reporting, disabled traffic campaign creation and status/budget changes. Ad groups, creatives and full targeting parity remain. |
| 5 | Canva/Adobe Express and external media workflows | `planned` | Canva, Adobe Express and Drive developer access/onboarding and native editing/import workflows remain. |
| 5 | Licensed Polotno visual editor | `inherited_unverified` | Inherited Polotno editor retained; commercial license and licensed-flow validation pending. |
| 5 | AI text, images and video generation | `inherited_unverified` | Inherited text/image/video creation retained with pending-activation UI; provider keys, limits and paid tests pending. |
| 5 | Video clipping and captioned outputs | `partial` | Inherited clipping adapted to Supabase signing/sealing with owned thumbnail records; RunPod/Deepgram deployment and paid end-to-end checks pending. |
| 5 | Third-party generated media ingestion | `inherited_unverified` | Pinned upstream surface; complete functional and live validation pending. |
