import {
  Body,
  Controller,
  Get,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Organization, Role, User } from '@prisma/client';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { WorkspaceService } from '@gitroom/nestjs-libraries/database/prisma/agency/workspace.service';
import { AgencyImportService } from '@gitroom/nestjs-libraries/database/prisma/agency/import.service';
import {
  CommitBrandImportDto,
  PreviewBrandImportDto,
} from '@gitroom/nestjs-libraries/dtos/agency/import.dto';
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })
)
@Controller('/agency/imports')
export class AgencyImportController {
  constructor(
    private readonly imports: AgencyImportService,
    private readonly workspace: WorkspaceService
  ) {}
  private access(user: User, org: Organization) {
    return this.workspace.requireRole(user.id, org.id, [
      Role.USER,
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
  }
  @Get('/') async history(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.access(user, org);
    return this.imports.history(org.id);
  }
  @Post('/preview') async preview(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: PreviewBrandImportDto
  ) {
    await this.access(user, org);
    return this.imports.preview(org.id, body.csv);
  }
  @Post('/') async commit(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: CommitBrandImportDto
  ) {
    await this.access(user, org);
    return this.imports.commit(org.id, body.requestId, body.csv);
  }
}
