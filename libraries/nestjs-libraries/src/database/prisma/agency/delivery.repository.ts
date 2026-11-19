import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';
import { ReviewRepository } from './review.repository';

@Injectable()
export class AgencyDeliveryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewRepository
  ) {}
  async claim(
    orgId: string,
    postId: string,
    version: number,
    owner: string,
    operation: string,
    occurrence = 'initial',
    expectedFingerprint?: string
  ) {
    const id = createHash('sha256')
      .update(JSON.stringify([orgId, postId, version, occurrence, operation]))
      .digest('hex');
    return this.prisma.$transaction(async (tx) => {
      await this.reviews.fence(tx, orgId);
      const post = await tx.post.findFirst({
        where: {
          id: postId,
          organizationId: orgId,
          deletedAt: null,
          approvalVersion: version,
          organization: { deletedAt: null },
          state: { in: ['QUEUE', 'PUBLISHED'] },
          integration: {
            organizationId: orgId,
            deletedAt: null,
            disabled: false,
          },
        },
        select: { group: true },
      });
      if (!post)
        throw new ForbiddenException(
          'The scheduled version was cancelled or changed'
        );
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { approvalRequired: true },
      });
      const { snapshot, fingerprint } = await this.reviews.snapshot(
        orgId,
        post.group,
        tx,
        org.approvalRequired
      );
      if (expectedFingerprint && fingerprint !== expectedFingerprint)
        throw new ForbiddenException(
          'The reviewed content or destination changed after this workflow was queued'
        );
      if (
        org.approvalRequired &&
        !(await tx.brandReview.findFirst({
          where: {
            organizationId: orgId,
            group: post.group,
            fingerprint,
            state: 'APPROVED',
          },
          select: { id: true },
        }))
      ) {
        throw new ForbiddenException(
          'Approval of the current post and processed media is required'
        );
      }
      const lease = await tx.brandDeliveryLease.findUnique({
        where: {
          organizationId_group: { organizationId: orgId, group: post.group },
        },
      });
      if (
        lease &&
        lease.state !== 'RELEASED' &&
        (lease.owner !== owner ||
          lease.fingerprint !== fingerprint ||
          lease.state === 'UNCERTAIN')
      ) {
        throw new ConflictException(
          'An earlier delivery needs reconciliation before another publish'
        );
      }
      const attempt = await tx.brandDeliveryAttempt.findUnique({
        where: { id },
      });
      if (
        attempt?.state === 'RESOLVED_PUBLISHED' ||
        attempt?.state === 'RESOLVED_NOT_PUBLISHED'
      ) {
        throw new ConflictException(
          'This occurrence was reconciled. Create and approve a new version before attempting a new delivery.'
        );
      }
      const unfinished = await tx.brandDeliveryAttempt.findFirst({
        where: {
          organizationId: orgId,
          group: post.group,
          state: { in: ['RUNNING', 'UNCERTAIN'] },
          id: { not: id },
        },
        select: { id: true },
      });
      if (unfinished)
        throw new ConflictException(
          'An earlier delivery needs reconciliation before another publish'
        );
      if (attempt && ['RUNNING', 'UNCERTAIN'].includes(attempt.state))
        throw new ConflictException(
          'This delivery may already have reached the network. Reconcile its outcome before retrying.'
        );
      await tx.brandDeliveryLease.upsert({
        where: {
          organizationId_group: { organizationId: orgId, group: post.group },
        },
        create: {
          organizationId: orgId,
          group: post.group,
          owner,
          fingerprint,
        },
        update: { owner, fingerprint, state: 'ACTIVE' },
      });
      const record =
        attempt && ['SUCCEEDED', 'ACCEPTED_PENDING'].includes(attempt.state)
          ? await tx.brandDeliveryAttempt.update({
              where: { id },
              data: { owner },
            })
          : await tx.brandDeliveryAttempt.upsert({
              where: { id },
              create: {
                id,
                organizationId: orgId,
                group: post.group,
                postId,
                owner,
                operation,
              },
              update: { state: 'RUNNING', error: null },
            });
      return { attempt: record, snapshot };
    });
  }
  finish(
    id: string,
    state: 'SUCCEEDED' | 'ACCEPTED_PENDING' | 'REJECTED' | 'UNCERTAIN',
    result?: string,
    error?: string
  ) {
    return this.prisma.brandDeliveryAttempt.update({
      where: { id },
      data: { state, result, error },
    });
  }
  async release(orgId: string, owner: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.reviews.fence(tx, orgId);
      const uncertain = await tx.brandDeliveryAttempt.findFirst({
        where: {
          organizationId: orgId,
          owner,
          state: { in: ['RUNNING', 'UNCERTAIN', 'ACCEPTED_PENDING'] },
        },
        select: { id: true },
      });
      await tx.brandDeliveryLease.updateMany({
        where: { organizationId: orgId, owner, state: 'ACTIVE' },
        data: { state: uncertain ? 'UNCERTAIN' : 'RELEASED' },
      });
    });
  }
  confirmed(orgId: string, postId: string, owner: string) {
    return this.prisma.brandDeliveryAttempt.updateMany({
      where: {
        organizationId: orgId,
        postId,
        owner,
        state: 'ACCEPTED_PENDING',
      },
      data: { state: 'SUCCEEDED' },
    });
  }
  uncertain(orgId: string, id: string) {
    return this.prisma.brandDeliveryAttempt.findFirst({
      where: {
        id,
        organizationId: orgId,
        state: { in: ['UNCERTAIN', 'RUNNING', 'ACCEPTED_PENDING'] },
      },
    });
  }
  async reconcile(
    orgId: string,
    id: string,
    actorId: string,
    outcome: 'PUBLISHED' | 'NOT_PUBLISHED',
    evidence: string,
    externalId?: string,
    releaseUrl?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.reviews.fence(tx, orgId);
      const attempt = await tx.brandDeliveryAttempt.findFirstOrThrow({
        where: {
          id,
          organizationId: orgId,
          state: { in: ['UNCERTAIN', 'RUNNING', 'ACCEPTED_PENDING'] },
        },
      });
      await tx.brandDeliveryAttempt.updateMany({
        where: {
          organizationId: orgId,
          postId: attempt.postId,
          state: { in: ['UNCERTAIN', 'RUNNING', 'ACCEPTED_PENDING'] },
        },
        data: {
          state: `RESOLVED_${outcome}`,
          reconciledBy: actorId,
          reconciledAt: new Date(),
          reconciliation: evidence,
        },
      });
      await tx.post.update({
        where: { id: attempt.postId, organizationId: orgId },
        data:
          outcome === 'PUBLISHED'
            ? {
                state: 'PUBLISHED',
                releaseId: externalId!,
                releaseURL: releaseUrl!,
              }
            : { state: 'DRAFT', approvalVersion: { increment: 1 } },
      });
      const pending = await tx.brandDeliveryAttempt.findFirst({
        where: {
          organizationId: orgId,
          group: attempt.group,
          state: { in: ['UNCERTAIN', 'RUNNING', 'ACCEPTED_PENDING'] },
        },
        select: { id: true },
      });
      if (!pending)
        await tx.brandDeliveryLease.updateMany({
          where: { organizationId: orgId, group: attempt.group },
          data: { state: 'RELEASED' },
        });
      return { id, outcome };
    });
  }
  list(orgId: string) {
    return this.prisma.brandDeliveryAttempt.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        postId: true,
        operation: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
