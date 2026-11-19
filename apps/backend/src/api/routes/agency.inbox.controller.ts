import { UsePipes, ValidationPipe } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Organization, Role, User } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { WorkspaceService } from '@gitroom/nestjs-libraries/database/prisma/agency/workspace.service';
import { AgencyInboxService } from '@gitroom/nestjs-libraries/database/prisma/agency/inbox.service';
import {
  AssignBrandConversationDto,
  CreateBrandFlowDto,
  ReplyBrandMessageDto,
  SavedBrandReplyDto,
  ToggleBrandFlowDto,
} from '@gitroom/nestjs-libraries/dtos/agency/inbox.dto';
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })
)
@Controller('/agency/engagement')
export class AgencyInboxController {
  constructor(
    private readonly inbox: AgencyInboxService,
    private readonly workspace: WorkspaceService
  ) {}
  private async access(user: User, org: Organization, admin = false) {
    await this.workspace.requireRole(
      user.id,
      org.id,
      admin
        ? [Role.ADMIN, Role.SUPERADMIN]
        : [Role.USER, Role.ADMIN, Role.SUPERADMIN]
    );
  }
  @Get('/staff') async staff(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.access(user, org);
    return this.inbox.staff(org.id);
  }
  @Get('/inbox') async list(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.access(user, org);
    return this.inbox.list(org.id);
  }
  @Post('/sync') async sync(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.access(user, org);
    return this.inbox.sync(org.id);
  }
  @Post('/inbox/:id/reply') async reply(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ReplyBrandMessageDto
  ) {
    await this.access(user, org);
    return this.inbox.reply(
      org.id,
      id,
      body.content,
      body.requestId,
      user.name || user.email
    );
  }
  @Patch('/inbox/:id') async assign(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: AssignBrandConversationDto
  ) {
    await this.access(user, org);
    return this.inbox.assign(org.id, id, body.assignedTo, body.status);
  }
  @Get('/saved-replies') async saved(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.access(user, org);
    return this.inbox.savedReplies(org.id);
  }
  @Post('/saved-replies') async save(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: SavedBrandReplyDto
  ) {
    await this.access(user, org);
    return this.inbox.saveReply(org.id, body.title, body.content);
  }
  @Get('/flows') async flows(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.access(user, org);
    return this.inbox.flows(org.id);
  }
  @Post('/flows') async createFlow(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateBrandFlowDto
  ) {
    await this.access(user, org, true);
    return this.inbox.createFlow(org.id, body);
  }
  @Patch('/flows/:id') async toggle(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ToggleBrandFlowDto
  ) {
    await this.access(user, org, true);
    return this.inbox.updateFlow(org.id, id, body.enabled);
  }
}
