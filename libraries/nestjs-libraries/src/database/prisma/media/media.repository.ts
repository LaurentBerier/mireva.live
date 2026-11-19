import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { ReviewRepository } from '../agency/review.repository';
import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';

@Injectable()
export class MediaRepository {
  constructor(private _media: PrismaRepository<'media'>, private readonly reviews: ReviewRepository) {}

  private editMedia<T>(org: string, id: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.reviews.edit(org, async tx => {
      const asset = await tx.media.findFirst({ where: { id, organizationId: org }, select: { path: true } });
      const owners = asset ? await tx.media.findMany({ where: { organizationId: org, thumbnail: asset.path }, select: { id: true } }) : [];
      const relatedIds = [id, ...owners.map(owner => owner.id)];
      const posts = await tx.post.findMany({ where: { organizationId: org, deletedAt: null, OR: [...relatedIds.map(mediaId => ({ image: { contains: mediaId } })), ...(asset ? [{ image: { contains: asset.path } }, { settings: { contains: asset.path } }] : [])] }, select: { group: true, image: true, settings: true } });
      return posts.filter(post => (asset && post.settings?.includes(asset.path)) || (JSON.parse(post.image || '[]') as {id?: string; thumbnail?: string; path?: string}[]).some(image => relatedIds.includes(image.id) || image.thumbnail === asset?.path || image.path === asset?.path)).map(post => post.group);
    }, action);
  }

  saveFile(org: string, fileName: string, filePath: string, originalName?: string) {
    return this._media.model.media.create({
      data: {
        organization: {
          connect: {
            id: org,
          },
        },
        name: fileName,
        path: filePath,
        originalName: originalName || null,
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
  }

  startProcessing(org: string, id: string) {
    return this.editMedia(org, id, tx => tx.media.update({
      where: { id, organizationId: org },
      data: { status: 'processing', processingError: null },
      select: { id: true, status: true },
    }));
  }

  finishProcessing(
    org: string,
    id: string,
    data: { name?: string; path?: string; fileSize?: number; error?: string }
  ) {
    return this.editMedia(org, id, tx => tx.media.update({
      where: { id, organizationId: org },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.path ? { path: data.path } : {}),
        ...(data.fileSize ? { fileSize: data.fileSize } : {}),
        status: data.error ? 'failed' : 'ready',
        processingError: data.error || null,
      },
      select: { id: true, status: true },
    }));
  }

  getMediaStatus(org: string, id: string) {
    return this._media.model.media.findFirst({
      where: {
        id,
        organizationId: org,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        status: true,
        processingError: true,
      },
    });
  }

  getMediaById(id: string) {
    return this._media.model.media.findUnique({
      where: {
        id,
      },
    });
  }
  getMediaForOrganization(id: string, organizationId: string) {
    return this._media.model.media.findFirst({ where: { id, organizationId, deletedAt: null } });
  }
  getMediaPathForOrganization(path: string, organizationId: string) {
    return this._media.model.media.findFirst({ where: { path, organizationId, deletedAt: null }, select: { id: true } });
  }

  deleteMedia(org: string, id: string) {
    return this.editMedia(org, id, tx => tx.media.update({
      where: {
        id,
        organizationId: org,
      },
      data: {
        deletedAt: new Date(),
      },
    }));
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this.editMedia(org, data.id, tx => tx.media.update({
      where: {
        id: data.id,
        organizationId: org,
      },
      data: {
        alt: data.alt,
        thumbnail: data.thumbnail,
        thumbnailTimestamp: data.thumbnailTimestamp,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        alt: true,
        thumbnail: true,
        path: true,
        thumbnailTimestamp: true,
      },
    }));
  }

  async getMedia(org: string, page: number, search?: string) {
    const pageNum = (page || 1) - 1;
    const trimmedSearch = search?.trim();
    const searchFilter = trimmedSearch
      ? {
          originalName: {
            contains: trimmedSearch,
            mode: 'insensitive' as const,
          },
        }
      : {};
    const query = {
      where: {
        organization: {
          id: org,
        },
        deletedAt: null,
        status: { not: 'processing' },
        ...searchFilter,
      },
    };
    const pages = Math.ceil((await this._media.model.media.count(query)) / 18);
    const results = await this._media.model.media.findMany({
      where: {
        organizationId: org,
        deletedAt: null,
        // still being normalized: it shows up once the workflow releases it
        status: { not: 'processing' },
        ...searchFilter,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        thumbnailTimestamp: true,
        createdAt: true,
      },
      skip: pageNum * 18,
      take: 18,
    });

    return {
      pages,
      results,
    };
  }
}
