import { UsePipes, ValidationPipe } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Organization, User, Role } from '@prisma/client';
import { AgencyDeliveryService } from '@gitroom/nestjs-libraries/database/prisma/agency/delivery.service';
import { AgencyOperationsService } from '@gitroom/nestjs-libraries/database/prisma/agency/operations.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { WorkspaceService } from '@gitroom/nestjs-libraries/database/prisma/agency/workspace.service';
import { ReviewService } from '@gitroom/nestjs-libraries/database/prisma/agency/review.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import {
  CreateBrandDto,
  UpdateBrandDto,
  InviteBrandMemberDto,
  UpdateBrandMemberDto,
  RequestBrandReviewDto,
  DecideBrandReviewDto,
  ReconcileBrandDeliveryDto,
} from '@gitroom/nestjs-libraries/dtos/agency/workspace.dto';

@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })
)
@Controller('/agency')
export class AgencyController {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly reviews: ReviewService,
    private readonly posts: PostsService,
    private readonly deliveries: AgencyDeliveryService,
    private readonly operations: AgencyOperationsService
  ) {}
  @Get('/operations') async operationsSummary(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.ADMIN,
      Role.SUPERADMIN,
      Role.USER,
    ]);
    return this.operations.summary(org.id);
  }
  @Get('/deliveries') async deliveryHistory(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.USER,
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.deliveries.list(org.id);
  }
  @Post('/deliveries/:id/reconcile') async reconcile(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ReconcileBrandDeliveryDto
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.deliveries.reconcile(org.id, id, user.id, body);
  }
  @Get('/context') context(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    return this.workspace.context(user.id, org.id);
  }
  @Get('/assets') assets(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    return this.workspace.readyMedia(user.id, org.id);
  }
  @Post('/:agencyId/brands') create(
    @GetUserFromRequest() user: User,
    @Param('agencyId') id: string,
    @Body() body: CreateBrandDto
  ) {
    return this.workspace.createBrand(
      user.id,
      id,
      body.name,
      body.timezoneName
    );
  }
  @Patch('/brand') update(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: UpdateBrandDto
  ) {
    return this.workspace.updateBrand(user.id, org.id, body);
  }
  @Get('/members') members(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    return this.workspace.members(user.id, org.id);
  }
  @Post('/members') invite(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: InviteBrandMemberDto
  ) {
    return this.workspace.invite(user.id, org, body.email, body.role);
  }
  @Patch('/members/:id') updateMember(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateBrandMemberDto
  ) {
    return this.workspace.updateMember(user.id, org.id, id, body);
  }
  @Get('/connections') connections(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    return this.workspace.readiness(user.id, org.id);
  }
  @Get('/inventory') inventory(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    return this.workspace.inventory(user.id, org.id);
  }
  @Get('/drafts') drafts(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    return this.workspace.drafts(user.id, org.id);
  }
  @Get('/reviews') listReviews(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    return this.reviews.list(user.id, org.id);
  }
  @Post('/reviews') requestReview(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: RequestBrandReviewDto
  ) {
    return this.reviews.request(user.id, org.id, body.group);
  }
  @Post('/reviews/:id/decision') decide(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: DecideBrandReviewDto
  ) {
    return this.reviews.decide(user.id, org.id, id, body.state, body.comment);
  }
  @Post('/reviews/:id/schedule') async schedule(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this.posts.changePostStatus(
      org.id,
      await this.reviews.approvedPost(user.id, org.id, id),
      'schedule'
    );
  }
}
