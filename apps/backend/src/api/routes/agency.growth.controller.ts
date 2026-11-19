import { UsePipes, ValidationPipe } from '@nestjs/common';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Organization, Role, User } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { WorkspaceService } from '@gitroom/nestjs-libraries/database/prisma/agency/workspace.service';
import { AgencyGrowthService } from '@gitroom/nestjs-libraries/database/prisma/agency/growth.service';
import {
  CreateBrandWebsiteDto,
  SaveBrandLinkPageDto,
} from '@gitroom/nestjs-libraries/dtos/agency/growth.dto';

@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })
)
@Controller('/agency/growth')
export class AgencyGrowthController {
  constructor(
    private readonly growth: AgencyGrowthService,
    private readonly workspace: WorkspaceService
  ) {}
  private async access(user: User, org: Organization) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.USER,
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
  }
  @Get('/links') async links(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.access(user, org);
    return this.growth.pages(org.id);
  }
  @Post('/links') async save(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: SaveBrandLinkPageDto
  ) {
    await this.access(user, org);
    return this.growth.savePage(org.id, body);
  }
  @Get('/links/:id/clicks') async clicks(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    await this.access(user, org);
    return this.growth.clickStats(org.id, id);
  }
  @Get('/websites') async websites(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.access(user, org);
    return this.growth.websites(org.id);
  }
  @Post('/websites') async addWebsite(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateBrandWebsiteDto
  ) {
    await this.access(user, org);
    return this.growth.createWebsite(org.id, body.domain);
  }
  @Get('/websites/stats') async stats(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.access(user, org);
    return this.growth.stats(org.id);
  }
}
