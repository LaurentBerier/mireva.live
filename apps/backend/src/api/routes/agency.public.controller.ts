import { UsePipes, ValidationPipe } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AgencyGrowthService } from '@gitroom/nestjs-libraries/database/prisma/agency/growth.service';
import { AgencyReportService } from '@gitroom/nestjs-libraries/database/prisma/agency/report.service';
import { RealIP } from 'nestjs-real-ip';
import { AgencyAnalyticsService } from '@gitroom/nestjs-libraries/database/prisma/agency/analytics.service';
import { AgencyRangeDto } from '@gitroom/nestjs-libraries/dtos/agency/analytics.dto';
import { AgencyOperationsService } from '@gitroom/nestjs-libraries/database/prisma/agency/operations.service';

@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })
)
@Controller('/agency-public')
export class AgencyPublicController {
  constructor(
    private readonly growth: AgencyGrowthService,
    private readonly reports: AgencyReportService,
    private readonly analytics: AgencyAnalyticsService,
    private readonly operations: AgencyOperationsService
  ) {}
  @Get('/health') ready() {
    return this.operations.ready();
  }
  @Get('/source') source(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="agency-corresponding-source.tar.gz"'
    );
    return this.operations.source().pipe(res);
  }
  @Get('/metrics') connector(
    @Headers('authorization') auth: string,
    @Query() query: AgencyRangeDto
  ) {
    return this.analytics.connector(auth, query.from, query.to);
  }
  @Get('/links/:slug') link(@Param('slug') slug: string) {
    return this.growth.publicPage(slug);
  }
  @Get('/links/:slug/:id') async click(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, await this.growth.click(slug, id, req.get('referer')));
  }
  @Get('/reports/:token') report(@Param('token') token: string) {
    return this.reports.publicReport(token);
  }
  @Get('/reports/:token/download') async reportDownload(
    @Param('token') token: string,
    @Res() res: Response
  ) {
    const result = await this.reports.publicDownload(token);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="social-report.${result.extension}"`
    );
    res.type(result.contentType).send(result.body);
  }
  @Get('/tracker.js') tracker(@Res() res: Response) {
    res
      .type('application/javascript')
      .setHeader('Cache-Control', 'public, max-age=3600');
    res.send(this.growth.trackerScript());
  }
  @Post('/track/:key') async track(
    @Param('key') key: string,
    @Body() body: unknown,
    @Req() req: Request,
    @RealIP() ip: string
  ) {
    let data: any;
    try {
      data = typeof body === 'string' ? JSON.parse(body) : body;
    } catch {
      throw new BadRequestException();
    }
    if (
      !data ||
      typeof data.pathname !== 'string' ||
      (data.referrer !== undefined && typeof data.referrer !== 'string') ||
      data.pathname.length > 2048 ||
      data.referrer?.length > 2048
    )
      throw new BadRequestException();
    return this.growth.track(
      key,
      data,
      req.get('origin') || '',
      ip,
      req.get('user-agent') || ''
    );
  }
}
