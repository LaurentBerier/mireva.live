import { UsePipes, ValidationPipe } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { Organization, Role, User } from '@prisma/client';
import { Response } from 'express';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { WorkspaceService } from '@gitroom/nestjs-libraries/database/prisma/agency/workspace.service';
import { AgencyReportService } from '@gitroom/nestjs-libraries/database/prisma/agency/report.service';
import { CreateBrandReportDto } from '@gitroom/nestjs-libraries/dtos/agency/report.dto';

@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })
)
@Controller('/agency/reports')
export class AgencyReportsController {
  constructor(
    private readonly reports: AgencyReportService,
    private readonly workspace: WorkspaceService
  ) {}
  @Get('/') async list(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    await this.workspace.context(user.id, org.id);
    return this.reports.list(org.id);
  }
  @Post('/') async create(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateBrandReportDto
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.USER,
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.reports.create(org, body);
  }
  @Post('/:id/share') async share(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.reports.share(org.id, id);
  }
  @Delete('/:id/share') async unshare(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    await this.workspace.requireRole(user.id, org.id, [
      Role.ADMIN,
      Role.SUPERADMIN,
    ]);
    return this.reports.unshare(org.id, id);
  }
  @Get('/:id/download') async download(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Res() response: Response
  ) {
    await this.workspace.context(user.id, org.id);
    const result = await this.reports.download(org, id);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="social-report.${result.extension}"`
    );
    response.type(result.contentType).send(result.body);
  }
}
