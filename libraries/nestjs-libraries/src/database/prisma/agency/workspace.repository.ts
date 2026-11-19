import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ReviewRepository } from './review.repository';

@Injectable()
export class WorkspaceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewRepository
  ) {}

  identity(supabaseId: string) {
    return this.prisma.user.findFirst({
      where: { supabaseId, activated: true, deletedAt: null },
      select: { id: true },
    });
  }
  syncEmail(supabaseId: string, email: string) {
    return this.prisma.user.updateMany({
      where: { supabaseId, email: { not: email } },
      data: { email },
    });
  }

  async context(userId: string, organizationId: string) {
    const [brands, memberships] = await Promise.all([
      this.prisma.userOrganization.findMany({
        where: { userId, disabled: false, organization: { deletedAt: null } },
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              agencyId: true,
              timezoneName: true,
              approvalRequired: true,
            },
          },
        },
        orderBy: { organization: { name: 'asc' } },
      }),
      this.prisma.agencyWorkspaceMember.findMany({
        where: { userId },
        select: { agencyId: true, role: true },
      }),
    ]);
    return {
      brands,
      memberships,
      current: brands.find((b) => b.organization.id === organizationId),
    };
  }

  agencyMember(agencyId: string, userId: string) {
    return this.prisma.agencyWorkspaceMember.findUnique({
      where: { agencyId_userId: { agencyId, userId } },
      select: { role: true },
    });
  }

  createBrand(
    agencyId: string,
    userId: string,
    name: string,
    timezoneName: string
  ) {
    return this.prisma.organization.create({
      data: {
        name,
        timezoneName,
        agencyId,
        approvalRequired: true,
        users: { create: { userId, role: Role.SUPERADMIN } },
      },
      select: {
        id: true,
        name: true,
        timezoneName: true,
        approvalRequired: true,
      },
    });
  }

  updateBrand(
    id: string,
    data: { name?: string; timezoneName?: string; approvalRequired?: boolean }
  ) {
    return this.reviews.edit(id, undefined, (tx) =>
      tx.organization.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.timezoneName !== undefined
            ? { timezoneName: data.timezoneName }
            : {}),
          ...(data.approvalRequired !== undefined
            ? { approvalRequired: data.approvalRequired }
            : {}),
        },
        select: {
          id: true,
          name: true,
          timezoneName: true,
          approvalRequired: true,
        },
      })
    );
  }

  findInvitedUser(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null, supabaseId: { not: null } },
      select: { id: true, supabaseId: true },
    });
  }

  async grantMembership(
    agencyId: string,
    organizationId: string,
    email: string,
    supabaseId: string,
    role: Role
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { supabaseId },
        create: {
          supabaseId,
          email,
          providerName: 'GENERIC',
          providerId: supabaseId,
          timezone: 0,
          timezoneName: 'America/Toronto',
          activated: true,
        },
        update: {},
        select: { id: true, email: true },
      });
      const existingMembership = await tx.userOrganization.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId },
        },
        select: { role: true },
      });
      if (existingMembership && existingMembership.role !== role)
        throw new ConflictException(
          'This member already has a role. Invitations cannot change existing permissions.'
        );
      await tx.userOrganization.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId } },
        create: { userId: user.id, organizationId, role },
        update: { role, disabled: false },
      });
      if (role !== Role.REVIEWER) {
        await tx.agencyWorkspaceMember.upsert({
          where: { agencyId_userId: { agencyId, userId: user.id } },
          create: { agencyId, userId: user.id, role: Role.USER },
          update: {},
        });
      }
      return { id: user.id, email: user.email, role };
    });
  }

  members(organizationId: string) {
    return this.prisma.userOrganization.findMany({
      where: { organizationId, disabled: false },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }
  async updateMember(
    organizationId: string,
    actorId: string,
    id: string,
    data: { role?: Role; disabled?: boolean }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.userOrganization.findFirst({
        where: { id, organizationId },
        select: { userId: true, role: true },
      });
      if (!member || member.role === 'SUPERADMIN' || member.userId === actorId)
        throw new ConflictException(
          'The agency owner and your own access cannot be changed here'
        );
      const updated = await tx.userOrganization.update({
        where: { id, organizationId },
        data: {
          ...(data.role !== undefined ? { role: data.role } : {}),
          ...(data.disabled !== undefined ? { disabled: data.disabled } : {}),
        },
        select: { id: true, role: true, disabled: true },
      });
      if (updated.disabled || updated.role === 'REVIEWER') {
        await tx.oAuthAuthorization.updateMany({
          where: { organizationId, userId: member.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      // Administrators can see the legacy shared brand key. Membership changes
      // cannot revoke a copied key without rotating it for the whole brand.
      if (member.role === 'ADMIN' && (updated.disabled || updated.role !== 'ADMIN')) {
        await tx.organization.update({ where: { id: organizationId }, data: { apiKey: randomUUID() }, select: { id: true } });
      }
      return updated;
    });
  }

  connections(organizationId: string) {
    return this.prisma.integration.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        providerIdentifier: true,
        disabled: true,
        refreshNeeded: true,
        inBetweenSteps: true,
        tokenExpiration: true,
      },
    });
  }

  drafts(organizationId: string) {
    return this.prisma.post.findMany({
      where: {
        organizationId,
        state: 'DRAFT',
        parentPostId: null,
        deletedAt: null,
      },
      select: {
        id: true,
        group: true,
        content: true,
        publishDate: true,
        image: true,
        integration: { select: { name: true, providerIdentifier: true } },
      },
      orderBy: { publishDate: 'asc' },
      take: 100,
    });
  }
  readyMedia(organizationId: string) {
    return this.prisma.media.findMany({
      where: { organizationId, deletedAt: null, status: 'ready' },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        fileSize: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}
