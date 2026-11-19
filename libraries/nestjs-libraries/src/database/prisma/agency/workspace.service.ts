import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Organization, Role } from '@prisma/client';
import { WorkspaceRepository } from './workspace.repository';
import { SupabaseIdentityService } from './supabase.identity.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import inventory from '../../../../../../docs/agency/feature-inventory.json';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly identity: SupabaseIdentityService,
    private readonly integrations: IntegrationManager
  ) {}

  async context(userId: string, organizationId: string) {
    const context = await this.repository.context(userId, organizationId);
    if (!context.current) throw new ForbiddenException();
    return context;
  }
  async readyMedia(userId: string, orgId: string) {
    await this.requireRole(userId, orgId, [
      Role.USER,
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.repository.readyMedia(orgId);
  }

  async requireRole(userId: string, organizationId: string, roles: Role[]) {
    const context = await this.context(userId, organizationId);
    if (!roles.includes(context.current!.role))
      throw new ForbiddenException('Your role cannot perform this action');
    return context;
  }

  async createBrand(
    userId: string,
    agencyId: string,
    name: string,
    timezoneName: string
  ) {
    const membership = await this.repository.agencyMember(agencyId, userId);
    if (
      !membership ||
      ![Role.ADMIN, Role.SUPERADMIN].includes(
        membership.role as 'ADMIN' | 'SUPERADMIN'
      )
    ) {
      throw new ForbiddenException();
    }
    this.validateTimezone(timezoneName);
    return this.repository.createBrand(agencyId, userId, name, timezoneName);
  }

  async updateBrand(
    userId: string,
    orgId: string,
    data: { name?: string; timezoneName?: string; approvalRequired?: boolean }
  ) {
    const context = await this.requireRole(userId, orgId, [
      Role.SUPERADMIN,
      Role.ADMIN,
    ]);
    if (data.approvalRequired !== undefined) {
      const agencyId = context.current!.organization.agencyId;
      const member = agencyId
        ? await this.repository.agencyMember(agencyId, userId)
        : null;
      if (!member || !['ADMIN', 'SUPERADMIN'].includes(member.role))
        throw new ForbiddenException(
          'Only an agency administrator can change the approval policy'
        );
    }
    if (data.timezoneName) this.validateTimezone(data.timezoneName);
    return this.repository.updateBrand(orgId, data);
  }

  async invite(userId: string, org: Organization, email: string, role: Role) {
    await this.requireRole(userId, org.id, [Role.SUPERADMIN, Role.ADMIN]);
    if (!org.agencyId)
      throw new BadRequestException('This brand has no agency');
    const supabaseId = await this.identity.invite(email.trim().toLowerCase());
    return this.repository.grantMembership(
      org.agencyId,
      org.id,
      email.trim().toLowerCase(),
      supabaseId,
      role
    );
  }

  async members(userId: string, orgId: string) {
    await this.requireRole(userId, orgId, [Role.SUPERADMIN, Role.ADMIN]);
    return this.repository.members(orgId);
  }
  async updateMember(
    userId: string,
    orgId: string,
    id: string,
    data: { role?: Role; disabled?: boolean }
  ) {
    await this.requireRole(userId, orgId, [Role.SUPERADMIN, Role.ADMIN]);
    return this.repository.updateMember(orgId, userId, id, data);
  }

  async readiness(userId: string, orgId: string) {
    await this.requireRole(userId, orgId, [
      Role.SUPERADMIN,
      Role.ADMIN,
      Role.USER,
    ]);
    return (await this.repository.connections(orgId)).map((connection) => ({
      ...connection,
      status: connection.disabled
        ? 'disabled'
        : connection.refreshNeeded
        ? 'reconnect_required'
        : connection.inBetweenSteps
        ? 'setup_required'
        : 'connected',
      liveVerification: 'not_verified',
      analyticsSupported:
        typeof this.integrations.getSocialIntegration(
          connection.providerIdentifier
        )?.analytics === 'function',
    }));
  }

  async inventory(userId: string, orgId: string) {
    await this.requireRole(userId, orgId, [
      Role.SUPERADMIN,
      Role.ADMIN,
      Role.USER,
    ]);
    return {
      ...inventory,
      providers: inventory.providers.map((provider) => ({
        ...provider,
        credentialStatus:
          provider.credentialEnvironmentVariables.length &&
          provider.credentialEnvironmentVariables.every(
            (key) => !!process.env[key]
          )
            ? 'configured_not_verified'
            : provider.credentialStatus,
      })),
    };
  }

  async drafts(userId: string, orgId: string) {
    await this.requireRole(userId, orgId, [
      Role.SUPERADMIN,
      Role.ADMIN,
      Role.USER,
    ]);
    return this.repository.drafts(orgId);
  }

  private validateTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
    } catch {
      throw new BadRequestException(
        'Use an IANA timezone such as America/Toronto'
      );
    }
  }
}
