import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AgencyReportRepository {
  constructor(private readonly prisma: PrismaService) {}
  create(
    orgId: string,
    data: Omit<Prisma.BrandReportUncheckedCreateInput, 'organizationId'>
  ) {
    return this.prisma.brandReport.create({
      data: { ...data, organizationId: orgId },
    });
  }
  list(orgId: string) {
    return this.prisma.brandReport.findMany({
      where: { organizationId: orgId, sourceReportId: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        from: true,
        to: true,
        format: true,
        monthlyDay: true,
        period: true,
        accentColor: true,
        logoMediaId: true,
        nextRunAt: true,
        lastRunAt: true,
        createdAt: true,
      },
    });
  }
  async get(orgId: string, id: string) {
    const report = await this.prisma.brandReport.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!report) throw new NotFoundException();
    return report;
  }
  share(orgId: string, id: string, hash: string, expiresAt: Date) {
    return this.prisma.brandReport.update({
      where: { id, organizationId: orgId },
      data: { shareTokenHash: hash, shareExpiresAt: expiresAt },
      select: { id: true },
    });
  }
  unshare(orgId: string, id: string) {
    return this.prisma.brandReport.update({
      where: { id, organizationId: orgId },
      data: { shareTokenHash: null, shareExpiresAt: null },
      select: { id: true },
    });
  }
  publicReport(hash: string) {
    return this.prisma.brandReport.findFirst({
      where: { shareTokenHash: hash, shareExpiresAt: { gt: new Date() } },
      include: { organization: true },
    });
  }
  due(now: Date) {
    return this.prisma.brandReport.findMany({
      where: { nextRunAt: { lte: now }, monthlyDay: { not: null } },
      include: { organization: true },
      take: 100,
    });
  }
  delivered(id: string, nextRunAt: Date) {
    return this.prisma.brandReport.update({
      where: { id },
      data: { lastRunAt: new Date(), nextRunAt },
      select: { id: true },
    });
  }
  monthlyDefinition(id: string) {
    return this.prisma.brandReport.findUnique({
      where: { id },
      include: { organization: true },
    });
  }
  monthlyCopy(
    sourceReportId: string,
    from: Date,
    to: Date,
    data: Prisma.BrandReportUncheckedCreateInput
  ) {
    return this.prisma.brandReport.upsert({
      where: { sourceReportId_from_to: { sourceReportId, from, to } },
      create: { ...data, sourceReportId, from, to },
      update: {},
    });
  }
}
