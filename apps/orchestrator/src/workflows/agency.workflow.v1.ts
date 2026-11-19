import {
  continueAsNew,
  executeChild,
  proxyActivities,
  sleep,
} from '@temporalio/workflow';
import type { AgencyActivity } from '../activities/agency.activity';
import { sendSingleEmailWorkflow } from './send.email.workflow';

const {
  agencySyncV1,
  agencyDueReportsV1,
  agencyPrepareReportV1,
  agencyReportDeliveredV1,
} = proxyActivities<AgencyActivity>({
  startToCloseTimeout: '30 minutes',
  retry: { maximumAttempts: 3, initialInterval: '1 minute' },
});
export async function agencyMonthlyReportV1(id: string) {
  const report = await agencyPrepareReportV1(id);
  if (!report) return;
  for (const [index, to] of report.recipients.entries()) {
    await executeChild(sendSingleEmailWorkflow, {
      workflowId: `agency-report-email-${id}-${report.url
        .split('/')
        .pop()}-${index}`,
      args: [
        {
          to,
          subject: 'Your monthly social media report',
          html: `<p>Your report is ready.</p><p><a href="${report.url}">View and download the report</a></p><p>This link expires in seven days.</p>`,
          addTo: 'bottom',
        },
      ],
    });
  }
  await agencyReportDeliveredV1(id, report.day!);
}
export async function agencyMaintenanceV1() {
  for (let hour = 0; hour < 24; hour++) {
    await agencySyncV1();
    for (const report of await agencyDueReportsV1()) {
      try {
        await executeChild(agencyMonthlyReportV1, {
          workflowId: `agency-monthly-${report.id}-${report.period}`,
          args: [report.id],
        });
      } catch {
        /* A failed report retains nextRunAt and remains visible for operator recovery. */
      }
    }
    await sleep('1 hour');
  }
  return continueAsNew<typeof agencyMaintenanceV1>();
}
