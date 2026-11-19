import { UsePipes, ValidationPipe } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Organization, Role, User } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { WorkspaceService } from '@gitroom/nestjs-libraries/database/prisma/agency/workspace.service';
import { AgencyAdvertisingService } from '@gitroom/nestjs-libraries/database/prisma/agency/advertising.service';
import {
  AddBrandAdAccountDto,
  CreateBrandCampaignDto,
  UpdateBrandCampaignDto,
} from '@gitroom/nestjs-libraries/dtos/agency/advertising.dto';
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })
)
@Controller('/agency/ads')
export class AgencyAdvertisingController {
  constructor(
    private readonly ads: AgencyAdvertisingService,
    private readonly workspace: WorkspaceService
  ) {}
  private access(user: User, org: Organization, admin = false) {
    return this.workspace.requireRole(
      user.id,
      org.id,
      admin
        ? [Role.ADMIN, Role.SUPERADMIN]
        : [Role.USER, Role.ADMIN, Role.SUPERADMIN]
    );
  }
  @Get('/') async list(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.access(user, org);
    return this.ads.list(org.id);
  }
  @Post('/') async save(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: AddBrandAdAccountDto
  ) {
    await this.access(user, org, true);
    return this.ads.save(org.id, body);
  }
  @Post('/:id/sync') async sync(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    await this.access(user, org);
    return this.ads.sync(org.id, id);
  }
  @Post('/:id/campaigns') async create(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: CreateBrandCampaignDto
  ) {
    await this.access(user, org, true);
    return this.ads.create(org.id, id, body);
  }
  @Patch('/:id/campaigns/:campaignId') async update(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Param('campaignId') campaignId: string,
    @Body() body: UpdateBrandCampaignDto
  ) {
    await this.access(user, org, true);
    return this.ads.update(org.id, id, campaignId, body);
  }
}
