import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
@Injectable()
export class AgencyImportRepository {
  constructor(private readonly prisma: PrismaService) {}
  previous(organizationId: string, requestId: string) {
    return this.prisma.brandImport.findUnique({
      where: { organizationId_requestId: { organizationId, requestId } },
    });
  }
  media(orgId: string, ids: string[]) {
    return this.prisma.media.findMany({
      where: {
        organizationId: orgId,
        id: { in: ids },
        deletedAt: null,
        status: 'ready',
      },
      select: { id: true, path: true, alt: true, thumbnail: true },
    });
  }
  connections(orgId: string) {
    return this.prisma.integration.findMany({
      where: { organizationId: orgId, deletedAt: null, disabled: false },
      select: { id: true, name: true, providerIdentifier: true },
    });
  }
  async begin(
    orgId: string,
    requestId: string,
    fingerprint: string,
    owner: string
  ) {
    const now = new Date(),
      leaseUntil = new Date(Date.now() + 120000);
    const previous = await this.prisma.brandImport.findUnique({
      where: { organizationId_requestId: { organizationId: orgId, requestId } },
    });
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new ConflictException(
          'This import ID was used for a different CSV'
        );
      if (
        previous.state === 'RUNNING' &&
        previous.leaseUntil &&
        previous.leaseUntil > now
      )
        throw new ConflictException(
          'This import is running. Check its history before retrying.'
        );
      if (previous.state === 'COMPLETED')
        return { record: previous, cached: true };
      const resumed = await this.prisma.brandImport.updateMany({
        where: {
          id: previous.id,
          updatedAt: previous.updatedAt,
          state: { in: ['FAILED', 'RUNNING'] },
        },
        data: { state: 'RUNNING', owner, leaseUntil },
      });
      if (!resumed.count)
        throw new ConflictException('Another request resumed this import');
      return { record: previous, cached: false };
    }
    try {
      return {
        record: await this.prisma.brandImport.create({
          data: {
            organizationId: orgId,
            requestId,
            fingerprint,
            owner,
            leaseUntil,
          },
        }),
        cached: false,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Another request started this import. Check its history.'
        );
      throw error;
    }
  }
  existing(orgId: string, id: string) {
    return this.prisma.post.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
  }
  async renew(id: string, owner: string) {
    const changed = await this.prisma.brandImport.updateMany({
      where: { id, owner, state: 'RUNNING', leaseUntil: { gt: new Date() } },
      data: { leaseUntil: new Date(Date.now() + 120000) },
    });
    if (!changed.count)
      throw new ConflictException(
        'Import ownership expired. Retry using the same import ID.'
      );
  }
  async finish(
    id: string,
    owner: string,
    state: 'COMPLETED' | 'FAILED',
    results: Prisma.InputJsonValue
  ) {
    const changed = await this.prisma.brandImport.updateMany({
      where: { id, owner, state: 'RUNNING' },
      data: { state, results, leaseUntil: null },
    });
    if (!changed.count)
      throw new ConflictException('Another worker resumed this import');
  }
  history(orgId: string) {
    return this.prisma.brandImport.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, state: true, results: true, createdAt: true },
    });
  }
}
