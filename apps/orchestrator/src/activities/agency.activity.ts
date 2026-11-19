import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Activity,
  ActivityMethod,
  TemporalService,
} from 'nestjs-temporal-core';
import { AgencyAnalyticsRepository } from '@gitroom/nestjs-libraries/database/prisma/agency/analytics.repository';
import { AgencyAnalyticsService } from '@gitroom/nestjs-libraries/database/prisma/agency/analytics.service';
import { AgencyInboxService } from '@gitroom/nestjs-libraries/database/prisma/agency/inbox.service';
import { AgencyReportRepository } from '@gitroom/nestjs-libraries/database/prisma/agency/report.repository';
import { AgencyReportService } from '@gitroom/nestjs-libraries/database/prisma/agency/report.service';
import { AgencyGrowthRepository } from '@gitroom/nestjs-libraries/database/prisma/agency/growth.repository';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { AgencyOperationsRepository } from '@gitroom/nestjs-libraries/database/prisma/agency/operations.repository';

@Injectable()
@Activity()
export class AgencyActivity implements OnModuleInit {
  constructor(
    private readonly temporal: TemporalService,
    private readonly analyticsRepository: AgencyAnalyticsRepository,
    private readonly analytics: AgencyAnalyticsService,
    private readonly inbox: AgencyInboxService,
    private readonly reports: AgencyReportService,
    private readonly reportRepository: AgencyReportRepository,
    private readonly growth: AgencyGrowthRepository,
    private readonly email: EmailService,
    private readonly operations: AgencyOperationsRepository
  ) {}
  async onModuleInit() {
    if (process.env.RUN_AGENCY_SYNC !== 'true') return;
    await this.temporal.client
      .getRawClient()
      .workflow.start('agencyMaintenanceV1', {
        workflowId: 'agency-maintenance-v1',
        taskQueue: 'main',
        workflowIdConflictPolicy: 'USE_EXISTING',
      });
  }
  @ActivityMethod()
  async agencySyncV1() {
    const results: { organizationId: string; status: string }[] = [];
    for (const org of await this.analyticsRepository.organizations()) {
      try {
        await this.analytics.sync(org);
        if (process.env.ENGAGEMENT_ENABLED === 'true')
          await this.inbox.sync(org.id);
        results.push({ organizationId: org.id, status: 'completed' });
      } catch {
        results.push({ organizationId: org.id, status: 'failed' });
      }
    }
    await this.growth.pruneVisits();
    await this.operations.prune();
    return results;
  }
  @ActivityMethod()
  async agencyDueReportsV1() {
    if (!this.email.hasProvider()) return [];
    return (await this.reportRepository.due(new Date())).map((report) => ({
      id: report.id,
      period: new Date().toISOString().slice(0, 7),
    }));
  }
  @ActivityMethod()
  async agencyPrepareReportV1(id: string) {
    const prepared = await this.reports.monthlyRun(id);
    if (!prepared) return null;
    return {
      name: prepared.report.name,
      recipients: prepared.report.recipients,
      url: prepared.url,
      day: prepared.report.monthlyDay,
    };
  }
  @ActivityMethod()
  async agencyReportDeliveredV1(id: string, day: number) {
    await this.reportRepository.delivered(id, this.reports.nextMonthly(day));
  }
}
