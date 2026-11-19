import { UsePipes, ValidationPipe } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Organization, Role, User } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { WorkspaceService } from '@gitroom/nestjs-libraries/database/prisma/agency/workspace.service';
import { AgencyAnalyticsService } from '@gitroom/nestjs-libraries/database/prisma/agency/analytics.service';
import {
  AgencyRangeDto,
  AddCompetitorDto,
  AnalyzeBrandDto,
} from '@gitroom/nestjs-libraries/dtos/agency/analytics.dto';

@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })
)
@Controller('/agency/insights')
export class AgencyAnalyticsController {
  constructor(
    private readonly analytics: AgencyAnalyticsService,
    private readonly workspace: WorkspaceService
  ) {}
  @Get('/keys') async keys(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.analytics.keys(org.id);
  }
  @Post('/keys') async createKey(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.analytics.createKey(org.id);
  }
  @Delete('/keys/:id') async revokeKey(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.analytics.revokeKey(org.id, id);
  }
  @Get('/') async summary(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Query() query: AgencyRangeDto
  ) {
    await this.workspace.context(user.id, org.id);
    return this.analytics.summary(org, query.from, query.to);
  }
  @Post('/sync') async sync(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.USER,
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.analytics.sync(org);
  }
  @Post('/competitors') async competitor(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: AddCompetitorDto
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.USER,
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.analytics.addCompetitor(org.id, body.provider, body.handle);
  }
  @Post('/analyze') async analyze(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: AnalyzeBrandDto
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.USER,
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.analytics.analyze(org, body.question, body.from, body.to);
  }
}
