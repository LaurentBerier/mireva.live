import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AgencyMediaRepository {
  constructor(private readonly prisma: PrismaService) {}
  createTicket(
    organizationId: string,
    data: {
      objectKey: string;
      originalName: string;
      contentType: string;
      expectedSize: number;
      expiresAt: Date;
    }
  ) {
    return this.prisma.brandUploadTicket.create({
      data: { organizationId, ...data },
    });
  }
  ticket(organizationId: string, id: string) {
    return this.prisma.brandUploadTicket.findFirst({
      where: { id, organizationId },
    });
  }
  completed(organizationId: string, mediaId: string) {
    return this.prisma.media.findFirstOrThrow({
      where: { id: mediaId, organizationId, deletedAt: null },
    });
  }
  asset(organizationId: string, path: string) {
    return this.prisma.media.findFirst({
      where: { organizationId, path, deletedAt: null },
      select: { id: true },
    });
  }
  async complete(organizationId: string, id: string, path: string) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.brandUploadTicket.findFirst({
        where: { id, organizationId },
      });
      if (!ticket) throw new NotFoundException();
      const media = ticket.mediaId
        ? await tx.media.findFirst({
            where: { organizationId, id: ticket.mediaId, deletedAt: null },
            select: {
              id: true,
              name: true,
              originalName: true,
              path: true,
              thumbnail: true,
              alt: true,
              status: true,
            },
          })
        : null;
      if (ticket.completedAt && media) return { media, created: false };
      const claimed = await tx.brandUploadTicket.updateMany({
        where: {
          id,
          organizationId,
          completedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { completedAt: new Date() },
      });
      if (!claimed.count)
        throw new ConflictException('Upload expired or already completed');
      const saved = await tx.media.create({
        data: {
          organizationId,
          name: decodeURIComponent(path.split('/').pop()!),
          originalName: ticket.originalName,
          path,
          fileSize: ticket.expectedSize,
          type: ticket.contentType.startsWith('video/') ? 'video' : 'image',
        },
        select: {
          id: true,
          name: true,
          originalName: true,
          path: true,
          thumbnail: true,
          alt: true,
          status: true,
        },
      });
      await tx.brandUploadTicket.update({
        where: { id },
        data: { mediaId: saved.id },
      });
      return { created: true, media: saved };
    });
  }
}
