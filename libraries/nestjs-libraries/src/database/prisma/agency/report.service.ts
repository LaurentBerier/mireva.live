import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Organization } from '@prisma/client';
import { createHash, createHmac, randomBytes } from 'crypto';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';
import { AgencyReportRepository } from './report.repository';
import { AgencyAnalyticsService } from './analytics.service';
import { CreateBrandReportDto } from '@gitroom/nestjs-libraries/dtos/agency/report.dto';
import { MediaService } from '../media/media.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { getSsrfSafeAxios } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
const { fileTypeFromBuffer } = require('file-type');
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AgencyReportService {
  constructor(
    private readonly repository: AgencyReportRepository,
    private readonly analytics: AgencyAnalyticsService,
    private readonly media: MediaService
  ) {}
  list(orgId: string) {
    return this.repository.list(orgId);
  }
  async create(org: Organization, body: CreateBrandReportDto) {
    const range = this.analytics.range(body.from, body.to);
    const report = await this.repository.create(org.id, {
      name: body.name,
      ...range,
      format: body.format,
      logoMediaId: body.logoMediaId,
      accentColor: body.accentColor || '612BD3',
      period: body.period || (body.monthlyDay ? 'PREVIOUS_MONTH' : 'FIXED'),
      recipients: body.recipients || [],
      monthlyDay: body.monthlyDay,
      nextRunAt: body.monthlyDay
        ? this.nextMonthly(body.monthlyDay)
        : undefined,
    });
    return { id: report.id, name: report.name, format: report.format };
  }
  nextMonthly(day: number, now = new Date()) {
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 14)
    );
    if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }
  async share(orgId: string, id: string) {
    await this.repository.get(orgId, id);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await this.repository.share(
      orgId,
      id,
      createHash('sha256').update(token).digest('hex'),
      expiresAt
    );
    return { url: `${process.env.FRONTEND_URL}/r/${token}`, expiresAt };
  }
  unshare(orgId: string, id: string) {
    return this.repository.unshare(orgId, id);
  }
  async publicReport(token: string) {
    if (!/^[\w-]{43}$/.test(token)) throw new NotFoundException();
    const report = await this.repository.publicReport(
      createHash('sha256').update(token).digest('hex')
    );
    if (!report) throw new NotFoundException();
    const range = this.bounds(report, report.organization);
    const summary = await this.analytics.summary(
      report.organization,
      range.from.toISOString(),
      range.to.toISOString()
    );
    return {
      name: report.name,
      brand: report.organization.name,
      ...range,
      latest: summary.latest.map(
        ({ provider, metric, value, periodStart, definition }) => ({
          provider,
          metric,
          value,
          periodStart,
          definition,
        })
      ),
    };
  }
  async download(org: Organization, id: string) {
    const report = await this.repository.get(org.id, id);
    const range = this.bounds(report, org);
    const summary = await this.analytics.summary(
      org,
      range.from.toISOString(),
      range.to.toISOString()
    );
    const rows = summary.metrics.map((metric) => [
      metric.provider,
      metric.integrationId,
      metric.subjectId,
      metric.metric,
      metric.value,
      metric.periodStart.toISOString(),
      metric.definition,
    ]);
    if (report.format === 'csv')
      return {
        contentType: 'text/csv; charset=utf-8',
        extension: 'csv',
        body: Buffer.from(
          this.csv([
            [
              'Provider',
              'Profile',
              'Post',
              'Metric',
              'Value',
              'Period',
              'Definition',
            ],
            ...rows,
          ])
        ),
      };
    const title = `${org.name} · ${report.name}`;
    const subtitle = `${range.from.toISOString().slice(0, 10)} — ${range.to
      .toISOString()
      .slice(0, 10)}`;
    const logo = report.logoMediaId
      ? await this.logo(org.id, report.logoMediaId)
      : null;
    if (report.format === 'pptx') {
      const presentation = new PptxGenJS();
      presentation.layout = 'LAYOUT_WIDE';
      presentation.author = 'Agency Workspace';
      presentation.subject = title;
      presentation.title = title;
      const cover = presentation.addSlide();
      cover.background = { color: '171221' };
      if (logo)
        cover.addImage({
          data: `data:${logo.mime};base64,${logo.bytes.toString('base64')}`,
          x: 0.7,
          y: 0.4,
          w: 2,
          h: 0.7,
          sizingContain: true,
        } as any);
      cover.addText(title, {
        x: 0.7,
        y: 1.4,
        w: 11.8,
        h: 1.5,
        color: 'FFFFFF',
        fontSize: 32,
        fit: 'shrink',
        bold: true,
        breakLine: false,
      });
      cover.addText(subtitle, {
        x: 0.7,
        y: 3.3,
        w: 11,
        h: 0.5,
        color: 'C6B1FF',
        fontSize: 18,
      });
      const latest = summary.latest;
      if (!latest.length)
        cover.addText('No measurements are available for this period.', {
          x: 0.7,
          y: 4.2,
          w: 11,
          h: 0.6,
          color: 'FFFFFF',
          fontSize: 18,
        });
      for (let offset = 0; offset < latest.length; offset += 12) {
        const slide = presentation.addSlide();
        slide.addText('Provider measurements', {
          x: 0.5,
          y: 0.3,
          w: 12,
          h: 0.6,
          fontSize: 25,
          bold: true,
          color: report.accentColor,
        });
        slide.addTable(
          [
            ['Provider', 'Metric', 'Latest value', 'Period'],
            ...latest
              .slice(offset, offset + 12)
              .map((metric) => [
                metric.provider,
                metric.metric,
                String(metric.value),
                metric.periodStart.toISOString().slice(0, 10),
              ]),
          ].map((row) => row.map((text) => ({ text }))),
          {
            x: 0.5,
            y: 1.2,
            w: 12.2,
            h: 5.5,
            fontSize: 14,
            border: { color: 'DEDEDE', pt: 1 },
            margin: 0.1,
          }
        );
      }
      const body = (await presentation.write({
        outputType: 'nodebuffer',
      })) as Buffer;
      return {
        contentType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        extension: 'pptx',
        body,
      };
    }
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      info: { Title: title, Author: 'Agency Workspace' },
    });
    const chunks: Buffer[] = [];
    const complete = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    if (logo) {
      doc.image(logo.bytes, 44, 44, { fit: [160, 45] });
      doc.y = 110;
    }
    doc
      .fillColor(`#${report.accentColor}`)
      .fontSize(25)
      .text(title)
      .moveDown(0.4);
    doc.fillColor('#555555').fontSize(12).text(subtitle).moveDown(1.5);
    if (!summary.latest.length)
      doc.text(
        'No measurements are available for this period. Connect profiles and synchronize analytics to populate this report.'
      );
    for (const metric of summary.latest) {
      if (doc.y > 710) doc.addPage();
      doc
        .fillColor('#222222')
        .fontSize(14)
        .text(
          `${metric.provider} / ${metric.metric}: ${metric.value.toLocaleString(
            'en-CA'
          )}`
        );
      doc
        .fillColor('#666666')
        .fontSize(10)
        .text(
          `${metric.periodStart.toISOString().slice(0, 10)} · ${
            metric.definition
          }`
        )
        .moveDown(1);
    }
    doc.end();
    return {
      contentType: 'application/pdf',
      extension: 'pdf',
      body: await complete,
    };
  }
  csv(rows: unknown[][]) {
    return (
      '\ufeff' +
      rows
        .map((row) =>
          row
            .map((value) => {
              let text = String(value ?? '');
              if (typeof value === 'string' && /^[=+@\-\t\r]/.test(text))
                text = "'" + text;
              return '"' + text.replace(/"/g, '""') + '"';
            })
            .join(',')
        )
        .join('\r\n')
    );
  }
  bounds(
    report: { from: Date; to: Date; period: string },
    org: { timezoneName: string }
  ) {
    const now = dayjs().tz(org.timezoneName);
    if (report.period === 'CURRENT_MONTH')
      return {
        from: now.startOf('month').toDate(),
        to: now.endOf('month').toDate(),
      };
    if (report.period === 'PREVIOUS_MONTH') {
      const month = now.subtract(1, 'month');
      return {
        from: month.startOf('month').toDate(),
        to: month.endOf('month').toDate(),
      };
    }
    if (report.period === 'CURRENT_WEEK')
      return {
        from: now.startOf('week').toDate(),
        to: now.endOf('week').toDate(),
      };
    return { from: report.from, to: report.to };
  }
  private async logo(orgId: string, id: string) {
    const media = await this.media.getMediaForOrganization(id, orgId);
    if (!media || media.status !== 'ready' || media.fileSize > 1024 * 1024)
      throw new BadRequestException(
        'Choose a ready logo below 1 MB from this brand'
      );
    const storage = UploadFactory.createStorage();
    const url = storage.resolveDownloadUrl
      ? await storage.resolveDownloadUrl(media.path)
      : media.path;
    let bytes: Buffer;
    if (url !== media.path) {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok || !response.body)
        throw new BadRequestException('Logo is unavailable');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.length;
        if (size > 1024 * 1024) {
          await reader.cancel();
          throw new BadRequestException('Logo exceeds 1 MB');
        }
        chunks.push(next.value);
      }
      bytes = Buffer.concat(chunks);
    } else {
      const result = await getSsrfSafeAxios().get(url, {
        responseType: 'arraybuffer',
        maxContentLength: 1024 * 1024,
      });
      bytes = Buffer.from(result.data);
    }
    const detected = await fileTypeFromBuffer(bytes);
    if (!['image/png', 'image/jpeg'].includes(detected?.mime))
      throw new BadRequestException('Report logos must be PNG or JPEG');
    return { bytes, mime: detected.mime };
  }
  async monthlyRun(id: string) {
    const report = await this.repository.monthlyDefinition(id);
    if (!report || !report.monthlyDay || !report.recipients.length) return null;
    const range = this.bounds(
      { ...report, period: 'PREVIOUS_MONTH' },
      report.organization
    );
    const copy = await this.repository.monthlyCopy(
      report.id,
      range.from,
      range.to,
      {
        organizationId: report.organizationId,
        name: report.name,
        format: report.format,
        logoMediaId: report.logoMediaId,
        accentColor: report.accentColor,
        period: 'FIXED',
        ...range,
      }
    );
    const token = createHmac('sha256', process.env.JWT_SECRET!)
      .update(`report:${copy.id}`)
      .digest('base64url');
    await this.repository.share(
      report.organizationId,
      copy.id,
      createHash('sha256').update(token).digest('hex'),
      new Date(Date.now() + 7 * 86400000)
    );
    return { report, copy, url: `${process.env.FRONTEND_URL}/r/${token}` };
  }
  async publicDownload(token: string) {
    const report = await this.repository.publicReport(
      createHash('sha256').update(token).digest('hex')
    );
    if (!report) throw new NotFoundException();
    return this.download(report.organization, report.id);
  }
}
