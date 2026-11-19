import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, BrandReviewState } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { createHash, createHmac } from 'crypto';

const reviewPostSelect = {
  id: true,
  group: true,
  content: true,
  image: true,
  settings: true,
  integrationId: true,
  parentPostId: true,
  delay: true,
  intervalInDays: true,
  publishDate: true,
  approvalVersion: true,
  integration: {
    select: {
      name: true,
      providerIdentifier: true,
      internalId: true,
      customInstanceDetails: true,
      additionalSettings: true,
    },
  },
} satisfies Prisma.PostSelect;

@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  fenced<T>(
    orgId: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.fence(tx, orgId);
      return action(tx);
    });
  }

  async snapshot(
    orgId: string,
    group: string,
    client: Prisma.TransactionClient = this.prisma,
    strictMedia = true
  ) {
    const posts = await client.post.findMany({
      where: { organizationId: orgId, group, deletedAt: null },
      select: reviewPostSelect,
      orderBy: { id: 'asc' },
    });
    if (!posts.length) throw new NotFoundException('Post group not found');
    const brand = await client.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { timezoneName: true },
    });
    const resolved = await Promise.all(
      posts.map(async (post) => {
        const mediaPrefix = `${process.env.FRONTEND_URL}/api/backend/media/private/`;
        const references = [
          ...new Set(
            (
              JSON.stringify(JSON.parse(post.settings || '{}')).match(
                /https?:\/\/[^\s"'<>]+/g
              ) || []
            ).filter((url) => url.startsWith(mediaPrefix))
          ),
        ];
        const settingsMedia = await Promise.all(
          references.map(async (path) => {
            const media = await client.media.findFirst({
              where: {
                organizationId: orgId,
                path,
                status: 'ready',
                deletedAt: null,
              },
              select: { id: true, path: true, updatedAt: true },
            });
            if (!media)
              throw new BadRequestException(
                'Publishing options reference unavailable media outside this brand'
              );
            return media;
          })
        );
        if (post.content.includes(mediaPrefix))
          throw new BadRequestException(
            'Add private files as attachments instead of embedding a private download link in the public post text'
          );
        const images = JSON.parse(post.image || '[]') as {
          id?: string;
          alt?: string;
          thumbnail?: string;
        }[];
        const assets = await Promise.all(
          images.map(async (image) => {
            if (!image.id && strictMedia)
              throw new BadRequestException(
                'Save all attachments in this brand media library before requesting review'
              );
            if (!image.id) return image;
            const asset = await client.media.findFirst({
              where: {
                id: image.id,
                organizationId: orgId,
                deletedAt: null,
                status: 'ready',
              },
              select: {
                id: true,
                path: true,
                thumbnail: true,
                thumbnailTimestamp: true,
                alt: true,
                fileSize: true,
                updatedAt: true,
              },
            });
            if (!asset && strictMedia)
              throw new BadRequestException(
                'All attachments must belong to this brand and finish processing before review'
              );
            if (!asset) return image;
            const thumbnail = image.thumbnail ?? asset.thumbnail;
            const thumbnailAsset = thumbnail
              ? await client.media.findFirst({
                  where: {
                    organizationId: orgId,
                    path: thumbnail,
                    status: 'ready',
                    deletedAt: null,
                  },
                  select: { id: true, path: true, updatedAt: true },
                })
              : null;
            if (thumbnail && strictMedia && !thumbnailAsset)
              throw new BadRequestException(
                'Upload thumbnails to this brand media library before requesting review'
              );
            return {
              ...asset,
              alt: image.alt ?? asset.alt,
              thumbnail,
              thumbnailAsset,
            };
          })
        );
        const plugs = await client.plugs.findMany({
          where: {
            organizationId: orgId,
            integrationId: post.integrationId,
            activated: true,
          },
          orderBy: { id: 'asc' },
          select: { id: true, plugFunction: true, data: true },
        });
        const automations = plugs.map((plug) => ({
          id: plug.id,
          action: plug.plugFunction,
          preview: (JSON.parse(plug.data) as { name: string; value: unknown }[])
            .filter((field) =>
              ['post', 'message', 'content', 'text'].includes(field.name)
            )
            .map((field) => ({
              name: field.name,
              value: String(field.value ?? ''),
            })),
          configurationHash: createHmac('sha256', process.env.JWT_SECRET!)
            .update(plug.data)
            .digest('hex'),
        }));
        const identity = ({
          customInstanceDetails,
          additionalSettings,
          ...safe
        }: {
          customInstanceDetails: string | null;
          additionalSettings: string | null;
          [key: string]: unknown;
        }) => ({
          ...safe,
          configurationHash: createHmac('sha256', process.env.JWT_SECRET!)
            .update(JSON.stringify([customInstanceDetails, additionalSettings]))
            .digest('hex'),
        });
        const targets = Object.keys(JSON.parse(post.settings || '{}')).some(
          (key) => key.includes('plug-')
        )
          ? await client.integration.findMany({
              where: { organizationId: orgId, deletedAt: null },
              orderBy: { id: 'asc' },
              select: {
                id: true,
                name: true,
                providerIdentifier: true,
                internalId: true,
                customInstanceDetails: true,
                additionalSettings: true,
              },
            })
          : [];
        return {
          ...post,
          brandTimezone: brand.timezoneName,
          integration: identity(post.integration),
          assets,
          settingsMedia,
          automations,
          automationDestinations: targets.map(identity),
        };
      })
    );
    const snapshot = JSON.parse(
      JSON.stringify(resolved)
    ) as Prisma.InputJsonValue;
    return {
      snapshot,
      fingerprint: createHash('sha256')
        .update(JSON.stringify(snapshot))
        .digest('hex'),
    };
  }

  async request(orgId: string, group: string, userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.fence(tx, orgId);
        const { snapshot, fingerprint } = await this.snapshot(orgId, group, tx);
        await tx.brandReview.updateMany({
          where: {
            organizationId: orgId,
            group,
            fingerprint: { not: fingerprint },
            state: { in: ['PENDING', 'APPROVED'] },
          },
          data: { state: 'SUPERSEDED' },
        });
        return tx.brandReview.upsert({
          where: {
            organizationId_group_fingerprint: {
              organizationId: orgId,
              group,
              fingerprint,
            },
          },
          create: {
            organizationId: orgId,
            group,
            fingerprint,
            snapshot,
            requestedBy: userId,
          },
          update: {},
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async list(orgId: string) {
    const reviews = await this.prisma.brandReview.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return Promise.all(
      reviews.map(async (review) => ({
        ...review,
        current: await this.snapshot(orgId, review.group)
          .then((current) => current.fingerprint === review.fingerprint)
          .catch(() => false),
      }))
    );
  }

  async decide(
    orgId: string,
    id: string,
    userId: string,
    state: 'APPROVED' | 'CHANGES_REQUESTED',
    comment?: string
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.fence(tx, orgId);
        const review = await tx.brandReview.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!review) throw new NotFoundException('Review not found');
        if (review.state !== 'PENDING')
          throw new ConflictException('This review has already been decided');
        const current = await this.snapshot(orgId, review.group, tx);
        if (current.fingerprint !== review.fingerprint)
          throw new ConflictException(
            'The post changed. Request a new review.'
          );
        return tx.brandReview.update({
          where: { id },
          data: { state, comment, decidedBy: userId, decidedAt: new Date() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async approvalForPost(
    orgId: string,
    postId: string,
    expectedVersion?: number,
    expectedFingerprint?: string
  ) {
    const [org, post] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { approvalRequired: true },
      }),
      this.prisma.post.findFirst({
        where: { id: postId, organizationId: orgId, deletedAt: null },
        select: { group: true, approvalVersion: true },
      }),
    ]);
    if (!org || !post) return false;
    if (
      expectedVersion !== undefined &&
      expectedVersion !== post.approvalVersion
    )
      return false;
    const current =
      org.approvalRequired || expectedFingerprint
        ? await this.snapshot(
            orgId,
            post.group,
            this.prisma,
            org.approvalRequired
          )
        : undefined;
    if (expectedFingerprint && current?.fingerprint !== expectedFingerprint)
      return false;
    if (!org.approvalRequired) return true;
    return !!(await this.prisma.brandReview.findFirst({
      where: {
        organizationId: orgId,
        group: post.group,
        fingerprint: current.fingerprint,
        state: 'APPROVED',
      },
      select: { id: true },
    }));
  }

  async policy(orgId: string) {
    return this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { approvalRequired: true, timezoneName: true },
    });
  }
  async fingerprintForPost(orgId: string, postId: string) {
    const post = await this.prisma.post.findFirstOrThrow({
      where: { id: postId, organizationId: orgId, deletedAt: null },
      select: { group: true },
    });
    const policy = await this.policy(orgId);
    return (
      await this.snapshot(
        orgId,
        post.group,
        this.prisma,
        policy.approvalRequired
      )
    ).fingerprint;
  }
  review(orgId: string, id: string) {
    return this.prisma.brandReview.findFirst({
      where: { id, organizationId: orgId },
    });
  }

  // Every content mutation and publish claim locks the same brand row first.
  // This closes the check/edit race without holding a database transaction over a provider request.
  fence(tx: Prisma.TransactionClient, orgId: string) {
    return tx.organization.update({
      where: { id: orgId },
      data: { publicationFence: { increment: 1 } },
      select: { id: true },
    });
  }
  async edit<T>(
    orgId: string,
    groups:
      | string[]
      | ((tx: Prisma.TransactionClient) => Promise<string[]>)
      | undefined,
    action: (tx: Prisma.TransactionClient) => Promise<T>
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.fence(tx, orgId);
        const affectedGroups =
          typeof groups === 'function' ? await groups(tx) : groups;
        const lease = await tx.brandDeliveryLease.findFirst({
          where: {
            organizationId: orgId,
            ...(affectedGroups ? { group: { in: affectedGroups } } : {}),
            state: { in: ['ACTIVE', 'UNCERTAIN'] },
          },
          select: { id: true },
        });
        if (lease)
          throw new ConflictException(
            'Publishing is in progress or awaiting reconciliation. Resolve delivery before editing.'
          );
        return action(tx);
      },
      { timeout: 30000 }
    );
  }
}
