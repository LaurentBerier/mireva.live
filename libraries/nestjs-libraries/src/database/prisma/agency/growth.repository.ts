import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AgencyGrowthRepository {
  constructor(private readonly prisma: PrismaService) {}
  pages(orgId: string) {
    return this.prisma.brandLinkPage.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { clicks: true } } },
    });
  }
  savePage(
    orgId: string,
    id: string | undefined,
    data: Omit<
      Prisma.BrandLinkPageUncheckedCreateInput,
      'organizationId' | 'id'
    >
  ) {
    return id
      ? this.prisma.brandLinkPage.update({
          where: { id, organizationId: orgId },
          data,
        })
      : this.prisma.brandLinkPage.create({
          data: { ...data, organizationId: orgId },
        });
  }
  publicPage(slug: string) {
    return this.prisma.brandLinkPage.findFirst({
      where: { slug, published: true },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        theme: true,
        links: true,
      },
    });
  }
  click(pageId: string, linkId: string, referrer?: string) {
    return this.prisma.brandLinkClick.create({
      data: { pageId, linkId, referrer },
      select: { id: true },
    });
  }
  clickStats(orgId: string, id: string) {
    return this.prisma.brandLinkClick.groupBy({
      by: ['linkId'],
      where: { pageId: id, page: { organizationId: orgId } },
      _count: { _all: true },
    });
  }
  websites(orgId: string) {
    return this.prisma.brandWebsite.findMany({
      where: { organizationId: orgId },
    });
  }
  createWebsite(orgId: string, domain: string) {
    return this.prisma.brandWebsite.upsert({
      where: { organizationId_domain: { organizationId: orgId, domain } },
      create: { organizationId: orgId, domain },
      update: {},
    });
  }
  website(siteKey: string) {
    return this.prisma.brandWebsite.findUnique({ where: { siteKey } });
  }
  visit(data: Prisma.BrandWebsiteEventUncheckedCreateInput) {
    return this.prisma.brandWebsiteEvent.create({ data, select: { id: true } });
  }
  stats(orgId: string) {
    return this.prisma.brandWebsiteEvent.findMany({
      where: {
        website: { organizationId: orgId },
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      select: {
        websiteId: true,
        pathname: true,
        country: true,
        visitorKey: true,
        createdAt: true,
        referrer: true,
      },
      take: 100000,
      orderBy: { createdAt: 'desc' },
    });
  }
  pruneVisits() {
    return this.prisma.brandWebsiteEvent.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 90 * 86400000) } },
    });
  }
}
