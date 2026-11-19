import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AgencyAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}
  createKey(organizationId: string, tokenHash: string) {
    return this.prisma.brandAnalyticsKey.create({
      data: { organizationId, tokenHash },
      select: { id: true },
    });
  }
  keys(organizationId: string) {
    return this.prisma.brandAnalyticsKey.findMany({
      where: { organizationId, revokedAt: null },
      select: { id: true, createdAt: true },
    });
  }
  revokeKey(organizationId: string, id: string) {
    return this.prisma.brandAnalyticsKey.update({
      where: { id, organizationId },
      data: { revokedAt: new Date() },
      select: { id: true },
    });
  }
  key(tokenHash: string) {
    return this.prisma.brandAnalyticsKey.findFirst({
      where: { tokenHash, revokedAt: null, organization: { deletedAt: null } },
      include: { organization: true },
    });
  }
  organizations() {
    return this.prisma.organization.findMany({
      where: { agencyId: { not: null }, deletedAt: null },
    });
  }
  connections(orgId: string) {
    return this.prisma.integration.findMany({
      where: { organizationId: orgId, deletedAt: null, disabled: false },
      select: {
        id: true,
        name: true,
        providerIdentifier: true,
        refreshNeeded: true,
      },
    });
  }
  posts(orgId: string, from: Date, to: Date) {
    return this.prisma.post.findMany({
      where: {
        organizationId: orgId,
        state: 'PUBLISHED',
        deletedAt: null,
        parentPostId: null,
        publishDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        integrationId: true,
        content: true,
        publishDate: true,
        releaseId: true,
        integration: { select: { providerIdentifier: true, name: true } },
      },
      take: 500,
      orderBy: { publishDate: 'desc' },
    });
  }
  async store(rows: Prisma.BrandMetricCreateManyInput[]) {
    for (let offset = 0; offset < rows.length; offset += 50) {
      await this.prisma.$transaction(
        rows.slice(offset, offset + 50).map((row) =>
          this.prisma.brandMetric.upsert({
            where: { key: row.key },
            create: row,
            update: { value: row.value, collectedAt: new Date() },
          })
        )
      );
    }
  }
  metrics(orgId: string, from: Date, to: Date) {
    return this.prisma.brandMetric.findMany({
      where: { organizationId: orgId, periodStart: { gte: from, lte: to } },
      orderBy: { periodStart: 'asc' },
      take: 20000,
    });
  }
  competitors(orgId: string) {
    return this.prisma.brandCompetitor.findMany({
      where: { organizationId: orgId },
    });
  }
  competitor(orgId: string, provider: string, handle: string) {
    return this.prisma.brandCompetitor.upsert({
      where: {
        organizationId_provider_handle: {
          organizationId: orgId,
          provider,
          handle,
        },
      },
      create: { organizationId: orgId, provider, handle },
      update: {},
    });
  }
  updateCompetitor(id: string, data: Prisma.BrandCompetitorUpdateInput) {
    return this.prisma.brandCompetitor.update({ where: { id }, data });
  }
}
