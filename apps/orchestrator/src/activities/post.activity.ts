import { Injectable, HttpException } from '@nestjs/common';
import { ReviewService } from '@gitroom/nestjs-libraries/database/prisma/agency/review.service';
import { AgencyDeliveryService } from '@gitroom/nestjs-libraries/database/prisma/agency/delivery.service';
import { Context } from '@temporalio/activity';
import { createHash } from 'crypto';
import { ApplicationFailure } from '@temporalio/common';
import {
  Activity,
  ActivityMethod,
  TemporalService,
} from 'nestjs-temporal-core';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import {
  NotificationService,
  NotificationType,
} from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { Integration, Post, State } from '@prisma/client';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { AuthTokenDetails } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { timer } from '@gitroom/helpers/utils/timer';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import { TypedSearchAttributes } from '@temporalio/common';
import {
  organizationId,
  postId as postIdSearchParam,
} from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import {
  setHeartbeatDetails,
  withHeartbeat,
} from '@gitroom/nestjs-libraries/temporal/temporal.heartbeat';
import {
  BadBody,
  Disconnect,
  PublishedWithError,
  RefreshToken,
} from '@gitroom/nestjs-libraries/integrations/social.abstract';

// Drops fields the workflow and downstream activities never read — biggest wins are `error` (grows per retry) and `childrenPost` (Prisma side-loads it on every recursive row).
function slimPost(post: any) {
  if (!post) return post;
  const {
    error,
    childrenPost,
    tags,
    description,
    title,
    submittedForOrderId,
    submittedForOrganizationId,
    submittedForOrder,
    submittedForOrganization,
    lastMessageId,
    parentPostId,
    approvedSubmitForOrder,
    deletedAt,
    createdAt,
    updatedAt,
    payoutProblems,
    comments,
    errors,
    ...rest
  } = post;
  return rest;
}

// A genuinely missed occurrence (dead workflow) is only recovered by the
// missing-posts sweep, which runs every hour - so anything later than the
// sweep period plus retry margin is a stale anchor, not a missed publish.
const REANCHOR_GRACE_MS = 2 * 60 * 60 * 1000;

// A repeat post keeps its original anchor publishDate forever (updatePost only
// flips the state, the calendar expands occurrences virtually). If the workflow
// gets that raw past date, any (re)start - an accidental edit resetting the
// state to QUEUE, or a missing-posts sweep poke - sleeps 0 and publishes
// instantly, machine-gunning the channel. Roll the returned date forward to the
// next occurrence on the anchor grid instead, so fresh starts wait for the next
// real occurrence. Only for the initial QUEUE run: repeat chain children
// (postNow) run against a PUBLISHED post and must keep publishing immediately.
// Occurrences missed within the grace window still catch up and post.
function reanchorInterval(post: any) {
  if (!post?.intervalInDays || post.state !== State.QUEUE) {
    return post;
  }

  const interval = post.intervalInDays * 24 * 60 * 60 * 1000;
  const late = Date.now() - new Date(post.publishDate).getTime();
  if (late <= REANCHOR_GRACE_MS) {
    return post;
  }

  const next =
    new Date(post.publishDate).getTime() +
    Math.ceil(late / interval) * interval;

  return { ...post, publishDate: new Date(next) };
}

@Injectable()
@Activity()
export class PostActivity {
  constructor(
    private _postService: PostsService,
    private _notificationService: NotificationService,
    private _integrationManager: IntegrationManager,
    private _integrationService: IntegrationService,
    private _refreshIntegrationService: RefreshIntegrationService,
    private _webhookService: WebhooksService,
    private _temporalService: TemporalService,
    private _subscriptionService: SubscriptionService,
    private readonly reviews: ReviewService,
    private readonly deliveries: AgencyDeliveryService
  ) {}

  private async approvedMutation<T>(integration: Integration, post: Pick<Post, 'id' | 'approvalVersion'> & { reviewFingerprint?: string }, operation: string, occurrence: string, action: () => Promise<T>) {
    const current = await this._integrationService.getIntegrationById(integration.organizationId, integration.id);
    if (!current || current.disabled || current.deletedAt || current.refreshNeeded) throw ApplicationFailure.nonRetryable('The channel is unavailable. Reconnect it before publishing.', 'bad_body');
    Object.assign(integration, current);
    await this.assertPostApprovedV1(integration.organizationId, post.id, post.approvalVersion, post.reviewFingerprint);
    if (integration.tokenExpiration && new Date(integration.tokenExpiration).getTime() < Date.now() + 60000) {
      const refreshed = await this._refreshIntegrationService.refresh(await this._integrationService.decryptTokens(integration));
      if (!refreshed) throw ApplicationFailure.nonRetryable('Reconnect the expired channel before publishing', 'bad_body');
      integration.token = refreshed.accessToken; integration.refreshToken = refreshed.refreshToken;
      integration.tokenExpiration = new Date(Date.now() + refreshed.expiresIn * 1000);
    }
    try {
      return await this.deliveries.execute(integration.organizationId, post.id, post.approvalVersion,
        Context.current().info.workflowExecution.runId, operation, occurrence, action, post.reviewFingerprint);
    } catch (error) {
      if (error instanceof HttpException && [409, 403].includes(error.getStatus())) throw ApplicationFailure.nonRetryable(error.message, 'bad_body');
      throw error;
    }
  }

  @ActivityMethod()
  postSocialApprovedV1(integration: Integration, posts: Post[], occurrence: string) {
    return this.approvedMutation(integration, posts[0], 'publish', occurrence, () => this.postSocialPending(integration, posts));
  }

  @ActivityMethod()
  postCommentApprovedV1(postId: string, lastPostId: string | undefined, integration: Integration, posts: Post[], occurrence: string) {
    return this.approvedMutation(integration, posts[0], 'comment', occurrence, () => this.postComment(postId, lastPostId, integration, posts));
  }

  @ActivityMethod()
  finalizePostApprovedV1(integration: Integration, pendingData: any, postId: string, version: number, occurrence: string, reviewFingerprint?: string) {
    const stage = createHash('sha256').update(JSON.stringify(pendingData)).digest('hex');
    return this.approvedMutation(integration, { id: postId, approvalVersion: version, reviewFingerprint }, `finalize:${stage}`, occurrence, () => this.finalizePost(integration, pendingData));
  }

  @ActivityMethod()
  releaseDeliveryV1(orgId: string, owner: string) { return this.deliveries.release(orgId, owner); }
  @ActivityMethod()
  confirmDeliveryV1(orgId: string, postId: string, owner: string) { return this.deliveries.confirmed(orgId, postId, owner); }

  @ActivityMethod()
  async processPlugApprovedV1(data: Parameters<PostActivity['processPlug']>[0], orgId: string, postId: string, version: number, occurrence: string, reviewFingerprint?: string) {
    const post = await this._postService.getPostById(postId, orgId);
    try { return await this.approvedMutation(post.integration, { id: postId, approvalVersion: version, reviewFingerprint }, `plug:${data.plugId}:${data.currentRun}`, occurrence, () => this.processPlug(data)); }
    finally { await this.deliveries.release(orgId, Context.current().info.workflowExecution.runId); }
  }
  @ActivityMethod()
  async processInternalPlugApprovedV1(data: Parameters<PostActivity['processInternalPlug']>[0], orgId: string, postId: string, version: number, occurrence: string, reviewFingerprint?: string) {
    const post = await this._postService.getPostById(postId, orgId);
    const key = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    try { return await this.approvedMutation(post.integration, { id: postId, approvalVersion: version, reviewFingerprint }, `internal-plug:${key}`, occurrence, () => this.processInternalPlug(data)); }
    finally { await this.deliveries.release(orgId, Context.current().info.workflowExecution.runId); }
  }

  @ActivityMethod()
  async assertPostApprovedV1(orgId: string, postId: string, version?: number, fingerprint?: string) {
    if (process.env.PUBLISHING_ENABLED !== 'true') {
      throw ApplicationFailure.nonRetryable('Live publishing is disabled in this environment', 'bad_body');
    }
    try { await this.reviews.assertApproved(orgId, postId, version, fingerprint); }
    catch { throw ApplicationFailure.nonRetryable('The current post version requires client approval', 'bad_body'); }
  }

  @ActivityMethod()
  async getIntegrationById(orgId: string, id: string) {
    return this._integrationService.getIntegrationById(orgId, id);
  }

  @ActivityMethod()
  async searchForMissingThreeHoursPosts() {
    const list = await this._postService.searchForMissingThreeHoursPosts();
    for (const post of list) {
      // the list can be long, the post may have been published since it was loaded
      const current = await this._postService.getPostState(post.id);
      if (current?.state !== 'QUEUE') {
        continue;
      }

      await this._temporalService.client
        .getRawClient()
        .workflow.signalWithStart('postWorkflowV113', {
          workflowId: `post_${post.id}`,
          taskQueue: 'main',
          signal: 'poke',
          workflowIdConflictPolicy: 'USE_EXISTING',
          signalArgs: [],
          args: [
            {
              taskQueue: post.integration.providerIdentifier
                .split('-')[0]
                .toLowerCase(),
              postId: post.id,
              organizationId: post.organizationId,
            },
          ],
          typedSearchAttributes: new TypedSearchAttributes([
            {
              key: postIdSearchParam,
              value: post.id,
            },
            {
              key: organizationId,
              value: post.organizationId,
            },
          ]),
        });
    }
  }

  @ActivityMethod()
  async updatePost(id: string, postId: string, releaseURL: string) {
    await this._postService.updatePost(id, postId, releaseURL);
  }

  @ActivityMethod()
  async getPost(orgId: string, postId: string) {
    if (process.env.STRIPE_SECRET_KEY) {
      const subscription = await this._subscriptionService.getSubscription(
        orgId
      );
      if (!subscription) {
        return false;
      }
    }
    const post = await this._postService.getPostById(postId, orgId);
    if (post.deletedAt) {
      return false;
    }

    return reanchorInterval(post);
  }

  @ActivityMethod()
  async getPostForApprovalV1(orgId: string, postId: string) {
    const post = await this.getPost(orgId, postId);
    if (!post) return false;
    const original = await this._postService.getPostById(postId, orgId);
    let date: string = original.publishDate.toISOString();
    if (original.state === 'QUEUE' && original.intervalInDays > 0 && Date.now() - +original.publishDate > REANCHOR_GRACE_MS) {
      const policy = await this.reviews.policy(orgId);
      const elapsedDays = Math.floor((Date.now() - +original.publishDate) / 86400000 / original.intervalInDays) * original.intervalInDays;
      date = this.reviews.nextOccurrence(date, elapsedDays, policy.timezoneName);
      while (+new Date(date) <= Date.now()) date = this.reviews.nextOccurrence(date, original.intervalInDays, policy.timezoneName);
    }
    return { ...post, publishDate: new Date(date), recurrenceAnchor: original.publishDate.toISOString(), reviewFingerprint: await this.reviews.fingerprint(orgId, postId) };
  }

  @ActivityMethod()
  nextRecurringOccurrenceV1(orgId: string, anchor: string, days: number, wallAnchor: string) { return this.reviews.recurringOccurrence(orgId, anchor, days, wallAnchor); }

  @ActivityMethod()
  async resolveRecurringOccurrenceV1(orgId: string, anchor: string, days: number, wallAnchor: string) {
    const policy = await this.reviews.policy(orgId);
    return this.reviews.availableOccurrence(anchor, days, policy.timezoneName, Date.now(), wallAnchor);
  }

  @ActivityMethod()
  failScheduledVersionV1(orgId: string, id: string, version: number, owner: string, error: string, fingerprint?: string) {
    return this._postService.failScheduledVersion(orgId, id, version, owner, error, fingerprint);
  }

  @ActivityMethod()
  async getPostsList(orgId: string, postId: string) {
    if (process.env.STRIPE_SECRET_KEY) {
      const subscription = await this._subscriptionService.getSubscription(
        orgId
      );
      if (!subscription) {
        return [];
      }
    }

    const getPosts = await this._postService.getPostsRecursively(
      postId,
      true,
      orgId
    );
    if (!getPosts || getPosts.length === 0 || getPosts[0].parentPostId) {
      return [];
    }

    // only the root drives the pre-publish sleep and the repeat schedule,
    // the rest are comments
    const [root, ...comments] = getPosts.map(slimPost);
    return [reanchorInterval(root), ...comments];
  }

  @ActivityMethod()
  async isCommentable(integration: Integration) {
    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    return !!getIntegration.comment;
  }

  @ActivityMethod()
  async postComment(
    postId: string,
    lastPostId: string | undefined,
    integration: Integration,
    posts: Post[]
  ) {
    integration = await this._integrationService.decryptTokens(integration);

    // kept only for in-flight postWorkflowV108 runs, which set a
    // heartbeatTimeout on this activity - removing the sender would kill
    // them. Under V109+ (no heartbeatTimeout) this is a no-op and can be
    // dropped once all V108 executions have drained
    return withHeartbeat(() =>
      this.handleDisconnect(integration, async () => {
        const getIntegration = this._integrationManager.getSocialIntegration(
          integration.providerIdentifier
        );

        const newPosts = await this._postService.updateTags(
          integration.organizationId,
          posts
        );

        return getIntegration.comment(
          integration.internalId,
          postId,
          lastPostId,
          integration.token,
          await Promise.all(
            (newPosts || []).map(async (p) => ({
              id: p.id,
              message: stripHtmlValidation(
                getIntegration.editor,
                p.content,
                true,
                false,
                !/<\/?[a-z][\s\S]*>/i.test(p.content),
                getIntegration.mentionFormat
              ),
              settings: await this._postService.resolveMediaSettings(integration.organizationId, JSON.parse(p.settings || '{}')),
              media: await this._postService.updateMedia(
                p.id,
                JSON.parse(p.image || '[]'),
                getIntegration?.convertToJPEG || false
              ),
            }))
          ),
          integration
        );
      })
    );
  }

  @ActivityMethod()
  async postSocial(integration: Integration, posts: Post[]) {
    return this.postSocialInternal(integration, posts, false);
  }

  // Used by postWorkflowV106 and up: providers that implement `postPending`
  // return a `pending` response the workflow resolves via checkPostStatus /
  // finalizePost. Older workflow versions keep calling `postSocial` and get
  // the old blocking behavior.
  @ActivityMethod()
  async postSocialPending(integration: Integration, posts: Post[]) {
    return this.postSocialInternal(integration, posts, true);
  }

  // For the providers with refreshRepeat: a token the platform rejects on the
  // finalize call means nothing was published, so the token is refreshed and
  // the call runs once more here, inside the activity. The workflows - frozen
  // once on main - refresh the token as well, but then go back to
  // checkPostStatus first, where a provider that arms and confirms its create
  // finds its own confirmed attempt and stops with a "may have already
  // published" warning for a post that was never created. When the token
  // cannot be refreshed the error goes to the workflow like before.
  private async refreshAndRepeat<T>(
    integration: Integration,
    func: (integration: Integration) => Promise<T>
  ): Promise<T> {
    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    try {
      return await func(integration);
    } catch (err) {
      if (!(err instanceof RefreshToken) || !getIntegration.refreshRepeat) {
        throw err;
      }

      setHeartbeatDetails(`${integration.providerIdentifier}: refresh token`);
      const refresh = await this._refreshIntegrationService
        .refresh(integration, err.message || '')
        .catch(() => false as const);
      if (!refresh || !refresh.accessToken) {
        throw err;
      }

      if (getIntegration.refreshWait) {
        await timer(10000);
      }

      return func({
        ...integration,
        token: refresh.accessToken,
        refreshToken: refresh.refreshToken || integration.refreshToken,
      });
    }
  }

  // A Disconnect error means the platform will keep rejecting this channel no
  // matter how many token refreshes (e.g. TikTok's daily active user cap):
  // mark the channel as needing a re-connect and notify the user, then rethrow
  // as BadBody so every workflow version - frozen once on main - treats it as
  // a terminal error without needing a new workflow.
  private async handleDisconnect<T>(
    integration: Integration,
    func: () => Promise<T>
  ): Promise<T> {
    try {
      return await func();
    } catch (err) {
      if (err instanceof Disconnect) {
        try {
          await this._integrationService.disconnectChannel(
            integration.organizationId,
            integration,
            err.message
          );
        } catch (e) {
          /**empty**/
        }

        throw new BadBody(
          integration.providerIdentifier,
          JSON.stringify({}),
          Buffer.from('{}'),
          err.message
        );
      }

      // The post is live but a follow-up mutation failed: keep its platform
      // id / URL on the post, then fail it as BadBody like any other error.
      if (err instanceof PublishedWithError) {
        try {
          await this._postService.updateResolvedRelease(
            err.postDbId,
            integration.organizationId,
            err.releaseId,
            err.releaseURL
          );
        } catch (e) {
          /**empty**/
        }

        throw new BadBody(
          integration.providerIdentifier,
          JSON.stringify({}),
          Buffer.from('{}'),
          err.message
        );
      }

      throw err;
    }
  }

  private async postSocialInternal(
    integration: Integration,
    posts: Post[],
    allowPending: boolean
  ) {
    if (process.env.AUTH_PROVIDER === 'supabase') {
      await this.assertPostApprovedV1(integration.organizationId, posts[0].id, posts[0].approvalVersion);
    }
    // The channel still holds the account id of the login step: no page was
    // selected, so the platform would reject the post. Thrown as BadBody so
    // every workflow version - frozen once on main - fails the post with this
    // message without needing a new workflow. A finished channel can hold the
    // page id in both fields, so a provider that knows its page ids is asked.
    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );
    if (
      getIntegration?.pageRequiredToPost &&
      !!integration.rootInternalId &&
      integration.internalId === integration.rootInternalId &&
      !getIntegration.isPageId?.(integration.internalId)
    ) {
      throw new BadBody(
        integration.providerIdentifier,
        JSON.stringify({}),
        Buffer.from('{}'),
        'The connection of this channel was not finished. Please finish connecting it and select the page or account to post to, then try again.'
      );
    }

    integration = await this._integrationService.decryptTokens(integration);

    // kept only for in-flight postWorkflowV108 runs, which set a
    // heartbeatTimeout on this activity - removing the sender would kill
    // them. Under V109+ (no heartbeatTimeout) this is a no-op and can be
    // dropped once all V108 executions have drained
    return withHeartbeat(() =>
      this.handleDisconnect(integration, () =>
        this.postSocialBody(integration, posts, allowPending)
      )
    );
  }

  private async postSocialBody(
    integration: Integration,
    posts: Post[],
    allowPending: boolean
  ) {
    // Stage markers: whatever ran last is what a timed-out activity reports.
    // Providers that go through this.fetch overwrite these with the exact URL;
    // the ones on their own HTTP client (x, youtube, bluesky) are still
    // narrowed down to the step they hung on.
    setHeartbeatDetails('subscription lookup');
    if (process.env.STRIPE_SECRET_KEY) {
      const subscription = await this._subscriptionService.getSubscription(
        integration.organizationId
      );

      if (!subscription) {
        throw new Error('No active subscription found for this organization.');
      }
    }

    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    setHeartbeatDetails('update tags');
    const newPosts = await this._postService.updateTags(
      integration.organizationId,
      posts
    );

    setHeartbeatDetails('resolve media');
    const mappedPosts = await Promise.all(
      (newPosts || []).map(async (p) => ({
        id: p.id,
        message: stripHtmlValidation(
          getIntegration.editor,
          p.content,
          true,
          false,
          !/<\/?[a-z][\s\S]*>/i.test(p.content),
          getIntegration.mentionFormat,
          !!getIntegration.inlineImages?.(JSON.parse(p.settings || '{}'))
        ),
        settings: await this._postService.resolveMediaSettings(integration.organizationId, JSON.parse(p.settings || '{}')),
        media: await this._postService.updateMedia(
          p.id,
          JSON.parse(p.image || '[]'),
          getIntegration?.convertToJPEG || false
        ),
      }))
    );

    setHeartbeatDetails(`${integration.providerIdentifier}: publish`);
    const postNow =
      allowPending && getIntegration.postPending
        ? await getIntegration.postPending(
            integration.internalId,
            integration.token,
            mappedPosts,
            integration
          )
        : await getIntegration.post(
            integration.internalId,
            integration.token,
            mappedPosts,
            integration
          );

    // The post is already published at this point: the streak is best-effort,
    // failing the activity here would retry it and publish again.
    setHeartbeatDetails(`${integration.providerIdentifier}: published, streak`);
    try {
      await this._temporalService.client
        .getRawClient()
        .workflow.start('streakWorkflowV2', {
          args: [{ organizationId: integration.organizationId }],
          workflowId: `streak_${integration.organizationId}`,
          taskQueue: 'main',
          // Keep a running streak, it checks for newer posts before it ends
          workflowIdConflictPolicy: 'USE_EXISTING',
          typedSearchAttributes: new TypedSearchAttributes([
            {
              key: organizationId,
              value: integration.organizationId,
            },
          ]),
        });
    } catch (err) {
      /**empty**/
    }

    return postNow;
  }

  @ActivityMethod()
  async checkPostStatus(integration: Integration, pendingData: any) {
    integration = await this._integrationService.decryptTokens(integration);
    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    return this.handleDisconnect(integration, () =>
      getIntegration.checkPostStatus(integration.token, pendingData, integration)
    );
  }

  @ActivityMethod()
  async finalizePost(integration: Integration, pendingData: any) {
    integration = await this._integrationService.decryptTokens(integration);
    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    return withHeartbeat(() =>
      this.handleDisconnect(integration, () =>
        this.refreshAndRepeat(integration, (current) =>
          getIntegration.finalizePost(current.token, pendingData, current)
        )
      )
    );
  }

  @ActivityMethod()
  async inAppNotification(
    orgId: string,
    subject: string,
    message: string,
    sendEmail = false,
    digest = false,
    type: NotificationType = 'success'
  ) {
    await this._notificationService.inAppNotification(
      orgId,
      subject,
      message,
      sendEmail,
      digest,
      type
    );
  }

  @ActivityMethod()
  async globalPlugs(integration: Integration) {
    return this._postService.checkPlugs(
      integration.organizationId,
      integration.providerIdentifier,
      integration.id
    );
  }

  @ActivityMethod()
  async changeState(id: string, state: State, err?: any, body?: any) {
    await this._postService.changeState(id, state, err, body);
  }

  @ActivityMethod()
  async internalPlugs(integration: Integration, settings: any) {
    return this._postService.checkInternalPlug(
      integration,
      integration.organizationId,
      integration.id,
      settings
    );
  }

  @ActivityMethod()
  async sendWebhooks(postId: string, orgId: string, integrationId: string) {
    // Webhooks are best-effort and run after the post already published, so a
    // failure here must not fail the workflow.
    try {
      const webhooks = (await this._webhookService.getWebhooks(orgId)).filter(
        (f) => {
          return (
            f.integrations.length === 0 ||
            f.integrations.some((i) => i.integration.id === integrationId)
          );
        }
      );

      if (webhooks.length === 0) {
        return;
      }

      const post = await this._postService.getPostByForWebhookId(
        postId,
        integrationId
      );
      await Promise.all(
        webhooks.map(async (webhook) => {
          try {
            // webhook.url is validated at save time, but DNS can change
            // between then and now - pin resolution like every other
            // user-influenced outbound request.
            await fetch(webhook.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(post),
              // @ts-ignore — undici option, not in lib.dom fetch types
              dispatcher: getSsrfSafeDispatcher(),
            });
          } catch (e) {
            /**empty**/
          }
        })
      );
    } catch (err) {
      /**empty**/
    }
  }
  @ActivityMethod()
  async processPlug(data: {
    plugId: string;
    postId: string;
    delay: number;
    totalRuns: number;
    currentRun: number;
  }) {
    return this._integrationService.processPlugs(data);
  }

  @ActivityMethod()
  async processInternalPlug(data: {
    post: string;
    originalIntegration: string;
    integration: string;
    plugName: string;
    orgId: string;
    delay: number;
    information: any;
  }) {
    await this._integrationService.processInternalPlug(data);
  }

  @ActivityMethod()
  async refreshToken(
    integration: Integration
  ): Promise<false | AuthTokenDetails> {
    // The workflows call this from their catch block, an error thrown here
    // would fail the whole run: a token that cannot be read is answered like
    // a refresh that did not work, without flagging the channel
    try {
      integration = await this._integrationService.decryptTokens(integration);
    } catch (err) {
      console.error(
        `Could not read the tokens of integration ${integration?.id}:`,
        (err as Error)?.message
      );
      return false;
    }

    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    try {
      const refresh = await this._refreshIntegrationService.refresh(
        integration
      );
      if (!refresh) {
        return false;
      }

      if (getIntegration.refreshWait) {
        await timer(10000);
      }

      return refresh;
    } catch (err) {
      await this._refreshIntegrationService.setBetweenSteps(
        integration,
        (err as Error)?.message || ''
      );
      return false;
    }
  }

  @ActivityMethod()
  async refreshTokenWithCause(
    integration: Integration,
    cause: string
  ): Promise<false | AuthTokenDetails> {
    // The workflows call this from their catch block, an error thrown here
    // would fail the whole run: a token that cannot be read is answered like
    // a refresh that did not work, without flagging the channel
    try {
      integration = await this._integrationService.decryptTokens(integration);
    } catch (err) {
      console.error(
        `Could not read the tokens of integration ${integration?.id}:`,
        (err as Error)?.message
      );
      return false;
    }

    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    try {
      const refresh = await this._refreshIntegrationService.refresh(
        integration,
        cause
      );
      if (!refresh) {
        return false;
      }

      if (getIntegration.refreshWait) {
        await timer(10000);
      }

      return refresh;
    } catch (err) {
      await this._refreshIntegrationService.setBetweenSteps(
        integration,
        cause || (err as Error)?.message || ''
      );
      return false;
    }
  }
}
