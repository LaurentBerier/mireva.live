# Provider registration and activation

Baseline: Postiz `2f24e10f2204295f66a1999679e9896db3cb2094`, checked 2026-11-19. No developer apps or production credentials have been supplied. Existing adapter code is not proof of approved access or successful delivery.

## Deployment URLs

Set `FRONTEND_URL` to the stable HTTPS Vercel domain and `NEXT_PUBLIC_BACKEND_URL` to the externally reachable HTTPS backend API. Social OAuth callbacks in the pinned providers return to the **frontend**, using `{FRONTEND_URL}/integrations/social/{provider-id}`. Do not register the backend origin in place of this frontend callback.

For example, X returns to `https://social.example.com/integrations/social/x`; LinkedIn Page returns to `https://social.example.com/integrations/social/linkedin-page`. Register the exact deployed host and path, including connection variants. Give staging its own credentials and registered callbacks. Vercel preview deployments must not run production publishing jobs or reuse production OAuth state.

Supabase login confirmations, invitation acceptance, and password recovery are a separate identity flow. Register their implemented frontend routes in the Supabase Auth URL configuration; do not confuse them with social-network consent callbacks.

## Registration sequence

1. Establish the frontend, API, and media domains; publish accurate privacy, support, and deletion instructions on the agency's controlled HTTPS domain.
2. Create the provider application or bot under an agency-owned developer account. Record the owner, application identifier, environment, callback URLs, and support contact in the deployment inventory.
3. Read the adapter's requested scopes from [feature-inventory.json](feature-inventory.json), then compare them with the provider's current developer documentation and the approved use case. A source-declared scope is not a granted permission.
4. Register exact callbacks, configure products/APIs, verify domain ownership where required, and add only the designated test accounts.
5. Add credentials through the backend/orchestrator's secret configuration. Keep app secrets, channel tokens, bot tokens, and signing keys out of source control and client bundles.
6. Prepare and submit review materials when required. Keep approval status pending until evidence of the granted product and scopes exists.
7. Connect a test channel to its brand, inspect granted permissions, and run the activation checks below. Enable production capability only after its supported behavior is verified.

[Postiz provider setup](https://docs.postiz.com/self-host/providers/overview) documents the inherited callback scheme and shared application credentials.

## Registered publishing adapters

Variables below are observed in the pinned source and include inherited compatibility references; they must be audited before activation. A missing environment-variable list does not mean a channel can operate without user authorization.

| Provider ID | Connect method | Observed credential/config variables | Callback suffix on FRONTEND_URL |
| --- | --- | --- | --- |
| `bluesky` | credentials | Channel-specific configuration | No standard OAuth callback |
| `devto` | credentials | Channel-specific configuration | No standard OAuth callback |
| `discord` | oauth | `DISCORD_BOT_TOKEN_ID`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | `/integrations/social/discord` |
| `dribbble` | oauth | `DRIBBBLE_CLIENT_ID`, `DRIBBBLE_CLIENT_SECRET`, `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` | `/integrations/social/dribbble` |
| `facebook` | oauth | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | `/integrations/social/facebook` |
| `wrapcast` | in_app | `NEYNAR_APP_FID`, `NEYNAR_APP_MNEMONIC`, `NEYNAR_CLIENT_ID`, `NEYNAR_SECRET_KEY`, `NEYNAR_SPONSOR_SIGNERS` | No standard OAuth callback |
| `gmb` | oauth | `GOOGLE_GMB_CLIENT_ID`, `GOOGLE_GMB_CLIENT_SECRET`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | `/integrations/social/gmb` |
| `hashnode` | credentials | Channel-specific configuration | No standard OAuth callback |
| `instagram` | oauth | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | `/integrations/social/instagram` |
| `instagram-standalone` | oauth | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | `/integrations/social/instagram-standalone` |
| `kick` | oauth | `KICK_CLIENT_ID`, `KICK_SECRET` | `/integrations/social/kick` |
| `lemmy` | credentials | Channel-specific configuration | No standard OAuth callback |
| `linkedin-page` | oauth | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | `/integrations/social/linkedin-page` |
| `linkedin` | oauth | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | `/integrations/social/linkedin` |
| `listmonk` | credentials | Channel-specific configuration | No standard OAuth callback |
| `mastodon` | oauth | `MASTODON_CLIENT_ID`, `MASTODON_CLIENT_SECRET` | `/integrations/social/mastodon` |
| `medium` | credentials | Channel-specific configuration | No standard OAuth callback |
| `mewe` | oauth | `MEWE_API_KEY`, `MEWE_APP_ID` | `/integrations/social/mewe` |
| `moltbook` | in_app | Channel-specific configuration | No standard OAuth callback |
| `nostr` | credentials | Channel-specific configuration | No standard OAuth callback |
| `pinterest` | oauth | `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` | `/integrations/social/pinterest` |
| `reddit` | oauth | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | `/integrations/social/reddit` |
| `skool` | browser_extension | Channel-specific configuration | No standard OAuth callback |
| `slack` | oauth | `SLACK_ID`, `SLACK_SECRET` | `/integrations/social/slack` |
| `telegram` | in_app | `TELEGRAM_TOKEN` | No standard OAuth callback |
| `threads` | oauth | `THREADS_APP_ID`, `THREADS_APP_SECRET` | `/integrations/social/threads` |
| `tiktok-business` | oauth | `TIKTOK_BUSINESS_CLIENT_ID`, `TIKTOK_BUSINESS_CLIENT_SECRET` | `/integrations/social/tiktok-business/` |
| `tiktok` | oauth | `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET` | `/integrations/social/tiktok` |
| `tumblr` | oauth | `TUMBLR_CLIENT_ID`, `TUMBLR_CLIENT_SECRET` | `/integrations/social/tumblr` |
| `twitch` | oauth | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | `/integrations/social/twitch` |
| `vk` | oauth | `VK_ID` | `/integrations/social/vk` |
| `whop` | oauth | `WHOP_CLIENT_ID` | `/integrations/social/whop` |
| `wordpress` | credentials | Channel-specific configuration | No standard OAuth callback |
| `x` | oauth | `X_API_KEY`, `X_API_SECRET` | `/integrations/social/x` |
| `youtube` | oauth | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | `/integrations/social/youtube` |

`mastodon-custom` is a source-only variant whose registry entry is commented out. It is not an enabled adapter and must not appear as a live connection option.

## Shared credentials and review requirements

- **Meta:** Facebook Page and Instagram through Facebook Business share `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`. Standalone Instagram uses `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`. Configure the products and requested permissions for each flow, add tester roles, and complete business/app review where required. Publishing, insights, comments, and direct messaging have distinct access requirements; an approved publishing connection does not prove inbox access. [Instagram setup](https://docs.postiz.com/self-host/providers/instagram)
- **LinkedIn:** personal and Page flows share the client credentials but have separate callbacks. Check that the requested organization and member scopes appear in the granted products before accepting the channel. [LinkedIn Page setup](https://docs.postiz.com/self-host/providers/linkedin-page)
- **Google:** configure a Web OAuth client and consent screen, enable the relevant YouTube APIs, and use test users before production review. Business Profile can use its dedicated credentials or the existing YouTube fallback. Quota/compliance audits are a separate process from basic OAuth registration. [YouTube setup](https://docs.postiz.com/self-host/providers/youtube), [Google quota and audit guide](https://developers.google.com/youtube/data/guides/quota_and_compliance_audits)
- **X:** the inherited adapter uses OAuth 1.0a consumer credentials. Confirm Read/Write access and the exact callback in the current developer console. An empty scope array in source is not evidence that write permission is unnecessary. Current API pricing is usage-based; inspect the connected account's actual entitlement. [Postiz X setup](https://docs.postiz.com/self-host/providers/x-twitter), [X pricing](https://docs.x.com/x-api/getting-started/pricing)
- **Other OAuth providers:** use the registered provider ID in the callback table. Confirm account ownership, requested product scopes, token refresh, and posting format on the provider's official developer portal. The adapter's local scope declaration is retained in the inventory for review.

### TikTok eligibility and media transfer

TikTok's Direct Post guidance excludes tools restricted to internal/private account management. This agency deployment must not represent public Direct Post access as guaranteed: that capability remains pending until an eligible application and its actual approved access have been established. Unaudited clients have private-post and user restrictions. The inherited upload-to-TikTok-inbox mode requires the account owner to finish publication and must be shown as manual completion. [Official Direct Post guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines), [Postiz TikTok modes](https://docs.postiz.com/self-host/providers/tiktok)

For pull-from-URL delivery, verify an owned media domain or URL prefix. TikTok requires direct HTTPS media responses without redirects and continued access during a download task, which can last up to one hour. Freshly signed Supabase media URLs must satisfy both ownership verification and accessibility; do not store an expiring URL at scheduling time and assume it will work later. If that route cannot satisfy verification, the video adapter must use an eligible file-upload flow or remain pending. [Official media transfer guide](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide)

### API-only, credentials, bots, and extensions

Bluesky, Lemmy, Nostr, Medium, Dev.to, Hashnode, WordPress, and Listmonk use channel-specific account credentials rather than deployment-wide OAuth apps. Verify the endpoint and account privileges when each channel is connected. Moltbook has an in-app setup flow. Telegram uses an agency bot and target chat/channel permissions.

The public Postiz guide labels Twitch, Kick, VK, Nostr, Lemmy, Medium, Dev.to, Hashnode, WordPress, Listmonk, and Moltbook as API-only. Their adapters are registered in the pinned manager, but this does not prove a complete connection screen exists. Verify the supported connection surface for each; do not hide them from the delivery inventory or label them connected without a successful account connection. [Platform guide](https://docs.postiz.com/general/platforms/overview)

Skool uses the Postiz browser extension and existing session cookies. Build an extension that permits the deployment's domain in `externally_connectable`, set the resulting `EXTENSION_ID`, and verify brand-scoped communication and session renewal. The default store extension's host permissions do not automatically cover a new agency domain. Review the platform's permitted use before enabling this session-based adapter. [Extension setup](https://docs.postiz.com/self-host/configuration/chrome-extension)

## New integrations, separate from publishing providers

Meta Ads, Google Ads, TikTok Ads, inbox ingestion, competitor collection, and Looker Studio require their own implemented adapters and access verification. Publishing OAuth access is not blanket access to these capabilities.

For **Google Ads**, the current onboarding process associates access with the Google Cloud project. Developer tokens were sunset on September 9, 2026; a new integration should enable the API in Cloud Console and request the appropriate production access there. Do not follow obsolete instructions to request a new developer token from an Ads manager's API Center. [Google's migration and access guide](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)

Canva, Adobe Express, and Google Drive imports also remain planned integrations until their production credentials, approved integration flow, and actual asset transfers are verified.

## App review materials

For each requested provider product, prepare:

- An accurate description of the agency workflow, supported account types, expected users, publishing volume, and data accessed.
- A permission-to-feature table using the adapter's current scope list; explain only features actually implemented.
- Stable review URLs, reviewer access instructions, and designated test accounts where the provider permits them.
- A screen recording showing account connection, consent, a draft, channel-specific settings, approval, publishing result, disconnect, and error handling.
- Screenshots or recording for insights, inbox, or advertising permissions when those are requested; do not use publishing screenshots as evidence for unrelated products.
- Privacy, retention, revocation, account deletion, and support URLs matching the deployed behavior.
- API ownership/domain verification evidence and the provider's approval or rejection outcome, recorded without exposing secrets.

## Activation checks

1. Confirm adapter implementation, credentials configured, required products/scopes approved, and live verification as separate fields.
2. Connect an agency-owned test account to one brand. Check that another brand and its clients cannot inspect that connection or its media.
3. Exercise the allowed text/media format and a deliberately invalid format; confirm validation errors remain visible.
4. Request approval, verify unapproved scheduling is rejected, approve the current revision, and verify edits invalidate it.
5. Publish a designated test item through the normal workflow; record provider IDs, URL, timestamps, and actual result. Use private/test visibility where supported.
6. Test refresh/reconnect, revoked permission, provider throttling, delayed completion, and partial multi-network failure.
7. Verify analytics or inbox capabilities individually if enabled. Absence of supported data must be shown explicitly.
8. Record evidence in the deployment readiness inventory and only then enable the verified production capability.

CI and preview runs use mocks or designated test systems. No customer post, message, or advertising change is an acceptable automated smoke test.

## Inherited issues requiring verification

The pinned Dribbble refresh-token implementation references Pinterest credential names and a Pinterest redirect path. Treat Dribbble refresh as unverified until the implementation is audited and tested. The baseline documentation's network counts and API-only descriptions also differ from the registered source; the source inventory records these discrepancies instead of claiming unsupported parity.

The `tiktok-business` adapter explicitly requires a trailing slash on its redirect URI. Register `/integrations/social/tiktok-business/` exactly, including the slash; it is an exception to the generic callback example above.

## Phase 4 inbox API contracts

Researched against official documentation on 2026-11-19. These are implementation and registration notes, not live verification. No credentials have been configured, no new platform approval has been requested, and no live API operation was performed for this research. Retain per-connection capability checks; inherited publishing scopes do not automatically authorize an inbox.

### Benchmark coverage

Metricool currently documents the following inbox coverage. The agency plan additionally includes assignments and durable history; those remain separate implementation work.

| Network | Published Metricool inbox coverage |
| --- | --- |
| Facebook Pages | Comments and private messages |
| Instagram professional accounts | Comments and primary-inbox private messages |
| TikTok Business | Comments |
| X | Private messages |
| LinkedIn personal and company profiles | Comments and mentions; no direct messages |
| Google Business Profile | Reviews |
| YouTube | Comments on videos and Shorts |

The documented benchmark does not supply a general inbox for every publishing provider. [Metricool's current inbox guide](https://help.metricool.com/inbox-manager-how-to-manage-messages-and-comments-from-metricool-s9zze)

### Meta versions, Facebook Pages, and Messenger

New API clients can pin Graph/Marketing API `v27.0`, released November 4, 2026. The upstream publishing constant is `v25.0`; migrate and verify each integration independently rather than assuming a global version replacement is sufficient. [Meta version changelog](https://developers.facebook.com/documentation/development/graph-api/changelog)

Use `https://graph.facebook.com/v27.0` for the following routes:

| Operation | HTTP path and essential input |
| --- | --- |
| List Messenger conversations | `GET /{PAGE_ID}/conversations` |
| Read conversation messages | `GET /{CONVERSATION_ID}/messages?fields=id,created_time,from,to,message` |
| Reply in Messenger | `POST /{PAGE_ID}/messages`, JSON `{"recipient":{"id":"PSID"},"messaging_type":"RESPONSE","message":{"text":"..."}}` |
| Read post comments | `GET /{POST_ID}/comments` with pagination |
| Reply publicly to a comment | `POST /{COMMENT_ID}/comments`, parameter `message` |
| Send a private reply to a comment | `POST /{PAGE_ID}/messages`, JSON `{"recipient":{"comment_id":"COMMENT_ID"},"message":{"text":"..."}}`; use `post_id` instead for a visitor post |

Conversation reads require a Page access token from a person with the Page's `MESSAGING` task and `pages_manage_metadata`, `pages_read_engagement`, and `pages_messaging`. A Facebook-linked Instagram conversation uses `platform=instagram` and its Instagram messaging permissions. [Page conversations reference](https://developers.facebook.com/docs/graph-api/reference/page/conversations/), [conversation messages reference](https://developers.facebook.com/docs/graph-api/reference/conversation/messages/)

Page comment replies require `pages_manage_engagement` and the Page's `MODERATE` task; reading depends on access to the parent object, including Page read permissions. Check the returned `can_comment` capability before offering a reply. [Comments reference](https://developers.facebook.com/docs/graph-api/reference/v27.0/object/comments/)

Messenger sending requires `pages_messaging`; the normal response window is 24 hours, with separately documented exceptions. A Human Agent extension is for manual human responses, not keyword automation. Receive incoming messages through verified webhooks. [Messenger sending guide](https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages)

A private reply requires the Page token and `pages_messaging`. Send one message within seven days of the comment/post; further messages require the person to respond and reopen the 24-hour window. Standard-access apps are limited to people with an app role. Do not implement the obsolete `/{COMMENT_ID}/private_replies` route. [Facebook private reply reference](https://developers.facebook.com/documentation/business-messaging/messenger-platform/discovery/private-replies)

### Instagram comments and direct messages

Choose the connection's login product and token before choosing the host. Instagram Login uses `https://graph.instagram.com/v27.0` and an Instagram user token; Facebook Login uses `https://graph.facebook.com/v27.0` and the corresponding Page token. A professional account and the granted product permissions are required.

| Operation | HTTP path and essential input |
| --- | --- |
| List conversations through Instagram Login | `GET /{IG_USER_ID}/conversations` |
| Read conversation | `GET /{CONVERSATION_ID}?fields=messages` |
| Read message detail | `GET /{MESSAGE_ID}?fields=id,created_time,from,to,message` |
| Send DM through Instagram Login | `POST /{IG_USER_ID}/messages`, JSON `{"recipient":{"id":"IGSID"},"message":{"text":"..."}}` |
| Read comments / replies | `GET /{IG_MEDIA_ID}/comments`; `GET /{IG_COMMENT_ID}/replies` |
| Reply publicly | `POST /{IG_COMMENT_ID}/replies`, parameter `message` |
| Send comment-triggered private reply | `POST /{APP_USERS_IG_ID}/messages`, JSON `{"recipient":{"comment_id":"COMMENT_ID"},"message":{"text":"..."}}` |

Instagram Login needs `instagram_business_basic` and `instagram_business_manage_messages` for the inbox. Advanced access is required when serving accounts outside the app's owned/managed test accounts. Facebook-linked messaging uses `instagram_basic`, `instagram_manage_messages`, and `pages_manage_metadata`. The message window applies to automation; do not use the manual Human Agent extension for automated replies. [Instagram conversations](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/conversations-api), [Instagram messaging](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api)

Comment moderation needs `instagram_business_basic` plus `instagram_business_manage_comments` with Instagram Login, or `instagram_basic`, `instagram_manage_comments`, and `pages_read_engagement` with Facebook Login. The latter can require additional business-role permissions described in the reference. [Instagram comment moderation](https://developers.facebook.com/documentation/instagram-platform/comment-moderation)

Private replies allow one initial message per comment, within seven days for posts/Reels and only during a Live broadcast for Live comments. Follow-ups require a recipient response and the messaging window. Meta's private-reply references differ in permission tables by login flow; verify the actual comment and messaging entitlements and request both for a complete inbox. [Instagram private replies](https://developers.facebook.com/documentation/instagram-platform/private-replies), [Instagram Login private reply reference](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/private-replies)

### YouTube comments

Use the YouTube Data API `v3` at `https://www.googleapis.com/youtube/v3`:

- `GET /commentThreads?part=snippet,replies&allThreadsRelatedToChannelId={CHANNEL_ID}` or the `videoId` filter. Use exactly one supported filter and paginate.
- `GET /comments?part=snippet&parentId={TOP_LEVEL_COMMENT_ID}` with page tokens to retrieve all replies; embedded thread replies can be incomplete.
- `POST /comments?part=snippet`, JSON `{"snippet":{"parentId":"TOP_LEVEL_COMMENT_ID","textOriginal":"..."}}` to reply. OAuth scope: `https://www.googleapis.com/auth/youtube.force-ssl`.

Replies attach to top-level comments. Do not infer private messaging support. Community-post comment support is a restricted pilot for approved Cloud projects, distinct from ordinary video/Shorts comments. [Threads list](https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list), [replies list](https://developers.google.com/youtube/data/reference/rest/v3/comments/list), [reply creation](https://developers.google.com/youtube/data/reference/rest/v3/comments/insert)

### TikTok Business organic comments

Use `https://business-api.tiktok.com/open_api/v1.3` with the creator-authorized `Access-Token` from `/tt_user/oauth2/token/`. `business_id` is that grant's `open_id`; an Ads advertiser token is a different authorization.

- `GET /business/comment/list/?business_id={OPEN_ID}&video_id={VIDEO_ID}` reads comments. `include_replies=true` embeds at most three replies per comment.
- `GET /business/comment/reply/list/?business_id={OPEN_ID}&video_id={VIDEO_ID}&comment_id={COMMENT_ID}` reads paginated replies.
- `POST /business/comment/reply/create/`, JSON `{"business_id":"OPEN_ID","video_id":"VIDEO_ID","comment_id":"COMMENT_ID","text":"..."}` creates a reply.

Request the approved TikTok Accounts permission groups: scope ID `18030100` (Get Business Comment) for comment/reply reads and `18030200` (Manage Business Comment) for reply creation. Confirm the actual granted permissions in the app and token, rather than treating publishing access as sufficient. [Official permission matrix](https://business-api.tiktok.com/portal/docs/permission-scope/v1.3)

Follow `cursor`/`has_more`; deduplicate by comment ID. The comments reference warns of duplicates beyond the first 500 comments. Reply lists do not support hidden parent comments. Access remains pending until TikTok has approved the application and the business account's actual authorization works. [Comment list](https://business-api.tiktok.com/portal/docs/get-comments-on-an-owned-video/v1.3), [reply list](https://business-api.tiktok.com/portal/docs/get-all-replies-to-a-comment/v1.3), [reply creation](https://business-api.tiktok.com/portal/docs/reply-to-an-existing-comment-on-an-owned-video/v1.3)

### X direct messages

Use X API `v2` at `https://api.x.com/2`:

- `GET /dm_events`, `GET /dm_conversations/with/{PARTICIPANT_ID}/dm_events`, or `GET /dm_conversations/{CONVERSATION_ID}/dm_events` lists message events. Request `dm_event.fields=created_at,sender_id,text` and follow pagination.
- `POST /dm_conversations/with/{PARTICIPANT_ID}/messages` or `POST /dm_conversations/{CONVERSATION_ID}/messages`, JSON `{"text":"..."}`, sends a message.

Use user-context authorization. OAuth 2.0 PKCE needs `dm.read` and `dm.write`; request `offline.access` for refresh tokens. Check account entitlement, recipient settings, and current usage costs. The inherited publishing adapter stores an OAuth 1.0a `accessToken:accessSecret` pair; it requires signed OAuth 1.0a requests and must not be passed as an OAuth 2.0 bearer token. [DM lookup](https://docs.x.com/x-api/direct-messages/lookup/quickstart), [DM sending](https://docs.x.com/x-api/direct-messages/manage/quickstart), [OAuth 2.0 scopes and refresh](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)

### LinkedIn comments and mentions

Use `https://api.linkedin.com/rest`, bearer authorization, a supported `LinkedIn-Version: YYYYMM` (the reviewed `202608` documentation version is an example), and `X-Restli-Protocol-Version: 2.0.0`. URL-encode URNs in path/query values.

- `GET /socialActions/{ENCODED_SHARE_UGCPOST_OR_COMMENT_URN}/comments` lists comments/replies.
- `POST /socialActions/{ENCODED_TARGET_URN}/comments` creates a comment/reply. The JSON includes the authorized `actor` URN, parent post `object` URN, and `message: {text: "..."}`; include the parent comment URN as `parentComment` for a reply.

Organization read/write requires `r_organization_social_feed` / `w_organization_social_feed`; member writing uses `w_member_social_feed`. Member reading through `r_member_social_feed` is restricted to selected developers. Inherited posting scopes are not a substitute for approved Community Management access. Keep personal-profile read/mentions pending if the necessary entitlement is unavailable. [LinkedIn comments and current permissions](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api?view=li-lms-2026-08)

For organization mentions, register a validated webhook using `PUT /eventSubscriptions/(developerApplication:{APP_URN},user:{PERSON_URN},entity:{ORG_URN},eventType:ORGANIZATION_SOCIAL_ACTION_NOTIFICATIONS)` and `{"webhook":"https://..."}`. The subscriber needs `rw_organization_admin` and `ADMINISTRATOR` access. Bootstrap/reconcile with `GET /organizationalEntityNotifications?q=criteria&actions=List(COMMENT,SHARE_MENTION)&organizationalEntity={ENCODED_ORG_URN}`; notifications are retained for 60 days. Deduplicate `notificationId` and track `lastModifiedAt`. This organization contract does not prove generic personal-profile mention access. [Organization notification reference](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-social-action-notifications?view=li-lms-2026-08)

### Google Business Profile reviews

- `GET https://mybusiness.googleapis.com/v4/accounts/{ACCOUNT_ID}/locations/{LOCATION_ID}/reviews` lists reviews; follow `nextPageToken`.
- `PUT https://mybusiness.googleapis.com/v4/accounts/{ACCOUNT_ID}/locations/{LOCATION_ID}/reviews/{REVIEW_ID}/reply`, JSON `{"comment":"..."}`, creates or updates the owner's reply.

Use OAuth scope `https://www.googleapis.com/auth/business.manage` and an authorized, verified location. API approval and account access still need verification. These routes cover reviews, not general private messages. [Review list](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list), [review reply](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/updateReply)

## Phase 5 advertising API contracts

All advertising mutations require the agency's configured application and an account grant. Creating a campaign does not by itself create its budget, ad groups/ad sets, creatives, ads, conversion configuration, or approved targeting. Keep unsupported objective/account combinations pending. Start review/test campaign creation paused and require an explicit authorized activation action before enabling spend.

### Meta Ads

Use `https://graph.facebook.com/v27.0`:

| Operation | Route / essential input |
| --- | --- |
| List campaigns | `GET /act_{AD_ACCOUNT_ID}/campaigns?fields=id,name,status,effective_status,objective` |
| Campaign performance | `GET /act_{AD_ACCOUNT_ID}/insights?level=campaign&fields=campaign_id,campaign_name,spend,impressions,clicks,actions&time_range={...}` |
| Create campaign | `POST /act_{AD_ACCOUNT_ID}/campaigns`, objective-specific fields including `name`, `objective`, `status=PAUSED`, and `special_ad_categories` |
| Update / pause | `POST /{CAMPAIGN_ID}` with supported changed fields; `status=PAUSED` pauses |

Campaign/ad-set budgets, objectives, and required settings vary; validate the current reference before constructing a mutation. [Campaign reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign-group), [Insights reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights)

Use `ads_read` for read/insight access and `ads_management` for mutations. Serving other businesses' accounts requires the relevant advanced access and Marketing API access tier; a working Page publishing token does not establish this access. [Marketing API authorization](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization)

### Google Ads

Pin REST URL version `v26` (current release notes include minor `v26.2`; the route version remains `v26`). [Supported versions](https://developers.google.com/google-ads/api/docs/sunset-dates)

For new registrations, enable Google Ads API on the Google Cloud project and request production access in Cloud Console. The September 9, 2026 developer-token sunset makes the `developer-token` header optional and ignored for core Google Ads API calls; do not require users to obtain a new token from the Ads API Center. Test access and production access are separate. The App Conversion Tracking API has a distinct token exception, outside these campaign routes. [Current access and migration policy](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)

Use bearer OAuth with `https://www.googleapis.com/auth/adwords`, JSON request bodies, and customer IDs without hyphens:

| Operation | HTTP route / essential input |
| --- | --- |
| List campaigns / retrieve performance | `POST https://googleads.googleapis.com/v26/customers/{CUSTOMER_ID}/googleAds:search` or `googleAds:searchStream`, body `{"query":"SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign WHERE segments.date DURING LAST_30_DAYS"}` |
| Create campaign | `POST /v26/customers/{CUSTOMER_ID}/campaigns:mutate`, `operations:[{create:{name,status:"PAUSED",campaignBudget:"customers/.../campaignBudgets/...",advertisingChannelType:"SEARCH",...}}]`; required settings depend on campaign type |
| Update / pause | Same mutate route; `operations:[{updateMask:"status",update:{resourceName:"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}",status:"PAUSED"}}]` |

`searchStream` returns batches; preserve provider metric units such as `cost_micros`. An existing authorized budget resource is required where specified by the campaign type. [Search REST contract](https://developers.google.com/google-ads/api/rest/common/search), [mutation REST contract](https://developers.google.com/google-ads/api/rest/common/mutate)

### TikTok Ads

Use `https://business-api.tiktok.com/open_api/v1.3`, advertiser-authorized `Access-Token`, and JSON for POST bodies:

| Operation | HTTP route / essential input |
| --- | --- |
| List campaigns | `GET /campaign/get/?advertiser_id={ADVERTISER_ID}` with paging/filters |
| Create campaign | `POST /campaign/create/`, including `advertiser_id`, `campaign_name`, `objective_type`, objective-dependent budget fields, and explicit `operation_status=DISABLE` |
| Update campaign | `POST /campaign/update/` with `advertiser_id`, `campaign_id`, and supported changes |
| Pause campaign | `POST /campaign/status/update/`, JSON `{"advertiser_id":"...","campaign_ids":["..."],"operation_status":"DISABLE"}` |
| Read performance | `GET /report/integrated/get/`, with advertiser, report type, dimensions, metrics, date range, and pagination appropriate to the supported report schema |

The official SDK documents these campaign contracts. Request permission ID `200` (Read Campaigns), `201` (Create and Update Campaigns), and `44` (Consolidated Report) as needed, and verify the advertiser's actual authorization. [Official campaign SDK reference](https://github.com/tiktok/tiktok-business-api-sdk/blob/main/python_sdk/docs/CampaignCreationApi.md), [permission matrix](https://business-api.tiktok.com/portal/docs/permission-scope/v1.3)

Inspect `campaign_automation_type` before selecting mutation routes. Upgraded Smart+ uses `/smart_plus/campaign/get/`, `/smart_plus/campaign/create/`, `/smart_plus/campaign/update/`, and `/smart_plus/campaign/status/update/` rather than assuming the manual campaign contract applies. The status operation accepts `DISABLE` to pause. TikTok announces changes from January 1, 2027 for creation/copy of specified non-Search campaign objectives; do not freeze a single legacy campaign schema for every objective. Reporting `v2.0` is a separate contract and must not be silently substituted for the verified `v1.3` route. [Upgraded Smart+ FAQ](https://business-api.tiktok.com/portal/docs/upgraded-smart-plus-campaigns-faqs/v1.3), [Upgraded Smart+ status update](https://business-api.tiktok.com/portal/docs/update-the-operation-statuses-of-upgraded-smart-campaigns/v1.3)
