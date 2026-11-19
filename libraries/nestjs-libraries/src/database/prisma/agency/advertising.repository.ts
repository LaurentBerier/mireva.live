import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
@Injectable()
export class AgencyAdvertisingRepository {
  constructor(private readonly prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.brandAdAccount.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        provider: true,
        externalId: true,
        name: true,
        snapshots: true,
        collectedAt: true,
        lastError: true,
      },
    });
  }
  async get(orgId: string, id: string) {
    const account = await this.prisma.brandAdAccount.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!account) throw new NotFoundException();
    return account;
  }
  save(
    orgId: string,
    data: Omit<Prisma.BrandAdAccountUncheckedCreateInput, 'organizationId'>
  ) {
    return this.prisma.brandAdAccount.upsert({
      where: {
        organizationId_provider_externalId: {
          organizationId: orgId,
          provider: data.provider,
          externalId: data.externalId,
        },
      },
      create: { ...data, organizationId: orgId },
      update: {
        token: data.token,
        refreshToken: data.refreshToken,
        loginAccountId: data.loginAccountId,
        name: data.name,
      },
      select: { id: true, name: true, provider: true, externalId: true },
    });
  }
  record(id: string, snapshots: Prisma.InputJsonValue, error?: string) {
    return this.prisma.brandAdAccount.update({
      where: { id },
      data: { snapshots, collectedAt: new Date(), lastError: error || null },
      select: { id: true },
    });
  }
}
