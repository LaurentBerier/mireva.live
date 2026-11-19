import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
@Injectable()
export class AgencyOperationsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async ready() {
    await this.prisma.organization.findFirst({ select: { id: true } });
  }
  record(
    organizationId: string,
    kind: string,
    status: string,
    detail: Prisma.InputJsonValue
  ) {
    return this.prisma.brandSyncRun.create({
      data: { organizationId, kind, status, detail },
      select: { id: true },
    });
  }
  async summary(organizationId: string) {
    const cutoff = new Date(Date.now() - 15 * 60000);
    const [
      failedPublishes,
      overdueJobs,
      disconnected,
      uncertainDeliveries,
      overdueReports,
      synchronizations,
    ] = await Promise.all([
      this.prisma.post.count({
        where: {
          organizationId,
          state: 'ERROR',
          deletedAt: null,
          parentPostId: null,
        },
      }),
      this.prisma.post.count({
        where: {
          organizationId,
          state: 'QUEUE',
          deletedAt: null,
          parentPostId: null,
          publishDate: { lt: cutoff },
          intervalInDays: null,
        },
      }),
      this.prisma.integration.count({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { refreshNeeded: true },
            { disabled: true },
            { inBetweenSteps: true },
          ],
        },
      }),
      this.prisma.brandDeliveryLease.count({
        where: { organizationId, state: 'UNCERTAIN' },
      }),
      this.prisma.brandReport.count({
        where: {
          organizationId,
          sourceReportId: null,
          nextRunAt: { lt: cutoff },
        },
      }),
      this.prisma.brandSyncRun.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          kind: true,
          status: true,
          detail: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      failedPublishes,
      overdueJobs,
      disconnected,
      uncertainDeliveries,
      overdueReports,
      synchronizations,
    };
  }
  prune() {
    return this.prisma.brandSyncRun.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 90 * 86400000) } },
    });
  }
}
