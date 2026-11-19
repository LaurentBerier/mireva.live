import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AgencyMediaRepository } from './media.repository';
import { SupabaseStorage } from '@gitroom/nestjs-libraries/upload/supabase.storage';
import { MediaService } from '../media/media.service';
import {
  getMaxSize,
  UPLOAD_ALLOWED_MIME,
} from '@gitroom/nestjs-libraries/upload/custom.upload.validation';
const { fileTypeFromBuffer } = require('file-type');
const extension: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'video/mp4': 'mp4',
};

@Injectable()
export class AgencyMediaService {
  private provider?: SupabaseStorage;
  constructor(
    private readonly repository: AgencyMediaRepository,
    private readonly media: MediaService
  ) {}
  private storage() {
    if (process.env.STORAGE_PROVIDER !== 'supabase')
      throw new ServiceUnavailableException('Supabase storage is not enabled');
    return (this.provider ||= new SupabaseStorage());
  }
  async initialize(
    orgId: string,
    body: { name: string; contentType: string; size: number }
  ) {
    if (
      !UPLOAD_ALLOWED_MIME.has(body.contentType) ||
      !Number.isInteger(body.size) ||
      body.size <= 0 ||
      body.size > getMaxSize(body.contentType)
    )
      throw new BadRequestException('Unsupported file type or size');
    const objectKey = `${orgId}/${randomUUID()}.${extension[body.contentType]}`;
    const ticket = await this.repository.createTicket(orgId, {
      objectKey,
      originalName: body.name,
      contentType: body.contentType,
      expectedSize: body.size,
      expiresAt: new Date(Date.now() + 2 * 3600_000),
    });
    const signed = await this.storage().signedBrowserUpload(objectKey);
    return { ticketId: ticket.id, objectKey, ...signed };
  }
  async complete(orgId: string, id: string) {
    const ticket = await this.repository.ticket(orgId, id);
    if (!ticket || (!ticket.completedAt && ticket.expiresAt < new Date()))
      throw new NotFoundException('Upload ticket expired');
    const storage = this.storage();
    if (ticket.completedAt && ticket.mediaId)
      return this.repository.completed(orgId, ticket.mediaId);
    let sealed: Awaited<ReturnType<SupabaseStorage['sealFile']>>;
    try {
      if (!ticket.completedAt) {
        const probe = await storage.probeFile(ticket.objectKey);
        const detected = await fileTypeFromBuffer(probe.bytes);
        if (
          probe.size !== ticket.expectedSize ||
          detected?.mime !== ticket.contentType
        ) {
          await storage.removeFile(ticket.objectKey);
          throw new BadRequestException(
            'Uploaded contents do not match the declared file type and size'
          );
        }
      }
      sealed = await storage.sealFile(ticket.objectKey);
    } catch (error) {
      const current = await this.repository.ticket(orgId, id);
      if (current?.completedAt && current.mediaId)
        return this.repository.completed(orgId, current.mediaId);
      throw error;
    }
    let result: Awaited<ReturnType<AgencyMediaRepository['complete']>>;
    try {
      result = await this.repository.complete(orgId, id, sealed.path);
    } catch (error) {
      await storage.removeFile(sealed.filename).catch(() => {});
      const current = await this.repository.ticket(orgId, id);
      if (current?.completedAt && current.mediaId)
        return this.repository.completed(orgId, current.mediaId);
      throw error;
    }
    if (!result.created)
      await storage.removeFile(sealed.filename).catch(() => {});
    else await storage.removeFile(ticket.objectKey).catch(() => {});
    return result.created
      ? this.media.processSavedFile(orgId, result.media)
      : result.media;
  }
  async signedAsset(orgId: string, key: string) {
    const storage = this.storage();
    if (!(await this.repository.asset(orgId, storage.publicUrl(key))))
      throw new NotFoundException();
    return storage.signDownloadUrl(key, 60);
  }
}
