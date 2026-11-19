import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReviewRepository } from './review.repository';
import { WorkspaceService } from './workspace.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class ReviewService {
  constructor(
    private readonly repository: ReviewRepository,
    private readonly workspace: WorkspaceService
  ) {}
  async list(userId: string, orgId: string) {
    await this.workspace.context(userId, orgId);
    return this.repository.list(orgId);
  }
  async request(userId: string, orgId: string, group: string) {
    await this.workspace.requireRole(userId, orgId, [
      Role.USER,
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.repository.request(orgId, group, userId);
  }
  async decide(
    userId: string,
    orgId: string,
    id: string,
    state: 'APPROVED' | 'CHANGES_REQUESTED',
    comment?: string
  ) {
    await this.workspace.requireRole(userId, orgId, [Role.REVIEWER]);
    return this.repository.decide(orgId, id, userId, state, comment);
  }
  policy(orgId: string) {
    return this.repository.policy(orgId);
  }
  fingerprint(orgId: string, postId: string) {
    return this.repository.fingerprintForPost(orgId, postId);
  }
  nextOccurrence(
    anchor: string,
    days: number,
    zone: string,
    wallAnchor = anchor
  ) {
    const local =
      dayjs(anchor).tz(zone).add(days, 'day').format('YYYY-MM-DD') +
      'T' +
      dayjs(wallAnchor).tz(zone).format('HH:mm:ss.SSS');
    return dayjs.tz(local, zone).toISOString();
  }
  async recurringOccurrence(
    orgId: string,
    anchor: string,
    days: number,
    wallAnchor = anchor
  ) {
    const org = await this.repository.policy(orgId);
    return this.availableOccurrence(
      this.nextOccurrence(anchor, days, org!.timezoneName, wallAnchor),
      days,
      org!.timezoneName,
      Date.now(),
      wallAnchor
    );
  }
  availableOccurrence(
    anchor: string,
    days: number,
    zone: string,
    now = Date.now(),
    wallAnchor = anchor
  ) {
    let candidate = anchor;
    if (+new Date(candidate) < now - 2 * 3600000) {
      const intervals = Math.max(
        1,
        Math.floor((now - +new Date(candidate)) / 86400000 / days)
      );
      candidate = this.nextOccurrence(
        candidate,
        intervals * days,
        zone,
        wallAnchor
      );
      while (+new Date(candidate) <= now)
        candidate = this.nextOccurrence(candidate, days, zone, wallAnchor);
    }
    return candidate;
  }
  async approvedPost(userId: string, orgId: string, reviewId: string) {
    await this.workspace.requireRole(userId, orgId, [
      Role.USER,
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    const review = await this.repository.review(orgId, reviewId);
    const root = (review?.snapshot as any[] | undefined)?.find(
      (post) => !post.parentPostId
    );
    if (!root || review?.state !== 'APPROVED')
      throw new ForbiddenException('An approved review is required');
    await this.assertApproved(orgId, root.id, root.approvalVersion);
    return root.id as string;
  }
  async assertApproved(
    orgId: string,
    postId: string,
    expectedVersion?: number,
    expectedFingerprint?: string
  ) {
    if (
      !(await this.repository.approvalForPost(
        orgId,
        postId,
        expectedVersion,
        expectedFingerprint
      ))
    ) {
      throw new ForbiddenException(
        'Approval of the current post version is required before publishing'
      );
    }
  }
}
