import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InboxThread } from '@gitroom/nestjs-libraries/integrations/engagement/engagement.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class AgencyInboxRepository {
  constructor(private readonly prisma: PrismaService) {}
  staff(orgId: string) {
    return this.prisma.userOrganization.findMany({
      where: {
        organizationId: orgId,
        disabled: false,
        role: { in: ['USER', 'ADMIN', 'SUPERADMIN'] },
        user: { activated: true, deletedAt: null },
      },
      select: { user: { select: { id: true, name: true, email: true } } },
    });
  }
  connections(orgId: string) {
    return this.prisma.integration.findMany({
      where: { organizationId: orgId, deletedAt: null, disabled: false },
      select: { id: true, providerIdentifier: true },
    });
  }
  publishedIds(orgId: string, integrationId: string) {
    return this.prisma.post.findMany({
      where: {
        organizationId: orgId,
        integrationId,
        state: 'PUBLISHED',
        deletedAt: null,
        releaseId: { not: null },
      },
      select: { releaseId: true },
      take: 100,
      orderBy: { publishDate: 'desc' },
    });
  }
  list(orgId: string) {
    return this.prisma.brandConversation.findMany({
      where: { organizationId: orgId },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 100 } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }
  async conversation(orgId: string, id: string) {
    const item = await this.prisma.brandConversation.findFirst({
      where: { id, organizationId: orgId },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 100 } },
    });
    if (!item) throw new NotFoundException();
    return item;
  }
  async ingest(
    orgId: string,
    integrationId: string,
    provider: string,
    thread: InboxThread
  ) {
    const conversation = await this.prisma.brandConversation.upsert({
      where: {
        integrationId_externalId: { integrationId, externalId: thread.id },
      },
      create: {
        organizationId: orgId,
        integrationId,
        provider,
        externalId: thread.id,
        title: thread.title.slice(0, 500),
        kind: thread.kind,
        postExternalId: thread.postExternalId,
      },
      update: {
        title: thread.title.slice(0, 500),
        ...(thread.postExternalId
          ? { postExternalId: thread.postExternalId }
          : {}),
      },
      select: { id: true },
    });
    for (const message of thread.messages) {
      if (!message.id) continue;
      await this.prisma.brandMessage.upsert({
        where: {
          conversationId_externalId: {
            conversationId: conversation.id,
            externalId: message.id,
          },
        },
        create: {
          conversationId: conversation.id,
          externalId: message.id,
          author: message.author,
          authorId: message.authorId,
          content: message.content,
          direction: message.direction,
          createdAt: message.createdAt,
        },
        update: {},
      });
    }
    return conversation.id;
  }
  async assign(
    orgId: string,
    id: string,
    assignedTo?: string | null,
    status?: string
  ) {
    if (
      assignedTo &&
      !(await this.prisma.userOrganization.findFirst({
        where: {
          organizationId: orgId,
          userId: assignedTo,
          disabled: false,
          role: { in: ['ADMIN', 'SUPERADMIN', 'USER'] },
        },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Assigned staff member not found');
    return this.prisma.brandConversation.update({
      where: { id, organizationId: orgId },
      data: {
        ...(assignedTo !== undefined ? { assignedTo } : {}),
        ...(status ? { status } : {}),
      },
      select: { id: true, status: true, assignedTo: true },
    });
  }
  pendingMessage(requestKey: string) {
    return this.prisma.brandMessage.findUnique({ where: { requestKey } });
  }
  beginReply(
    conversationId: string,
    requestKey: string,
    content: string,
    author: string
  ) {
    return this.prisma.brandMessage.create({
      data: {
        conversationId,
        requestKey,
        externalId: `local:${requestKey}`,
        content,
        author,
        direction: 'OUTBOUND',
        deliveryStatus: 'SENDING',
      },
    });
  }
  finishReply(
    id: string,
    externalId: string | undefined,
    deliveryStatus: string
  ) {
    return this.prisma.brandMessage.update({
      where: { id },
      data: { ...(externalId ? { externalId } : {}), deliveryStatus },
    });
  }
  savedReplies(orgId: string) {
    return this.prisma.brandSavedReply.findMany({
      where: { organizationId: orgId },
    });
  }
  saveReply(orgId: string, title: string, content: string) {
    return this.prisma.brandSavedReply.create({
      data: { organizationId: orgId, title, content },
    });
  }
  flows(orgId: string) {
    return this.prisma.brandFlow.findMany({
      where: { organizationId: orgId },
      include: { executions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }
  createFlow(data: Prisma.BrandFlowUncheckedCreateInput) {
    return this.prisma.brandFlow.create({ data });
  }
  updateFlow(orgId: string, id: string, enabled: boolean) {
    return this.prisma.brandFlow.update({
      where: { id, organizationId: orgId },
      data: { enabled },
    });
  }
  matchingFlows(orgId: string, integrationId: string) {
    return this.prisma.brandFlow.findMany({
      where: { organizationId: orgId, integrationId, enabled: true },
    });
  }
  async claimFlow(flowId: string, messageId: string) {
    const result = await this.prisma.brandFlowExecution.createMany({
      data: [{ flowId, messageId }],
      skipDuplicates: true,
    });
    return !!result.count;
  }
  finishFlow(
    flowId: string,
    messageId: string,
    status: string,
    result: Prisma.InputJsonValue,
    error?: string
  ) {
    return this.prisma.brandFlowExecution.update({
      where: { flowId_messageId: { flowId, messageId } },
      data: { status, result, error, completedAt: new Date() },
    });
  }
  webhookConnections(accountId: string) {
    return this.prisma.integration.findMany({
      where: {
        internalId: accountId,
        providerIdentifier: {
          in: ['facebook', 'instagram', 'instagram-standalone'],
        },
        disabled: false,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        providerIdentifier: true,
        internalId: true,
      },
    });
  }
}
