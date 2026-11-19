import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { ReconcileBrandDeliveryDto } from '@gitroom/nestjs-libraries/dtos/agency/workspace.dto';
import { AgencyDeliveryRepository } from './delivery.repository';
import { EncryptionService } from '@gitroom/nestjs-libraries/services/encryption.service';

@Injectable()
export class AgencyDeliveryService {
  constructor(
    private readonly repository: AgencyDeliveryRepository,
    private readonly encryption: EncryptionService,
    private readonly temporal: TemporalService
  ) {}
  async execute<T>(
    orgId: string,
    postId: string,
    version: number,
    owner: string,
    operation: string,
    occurrence: string,
    action: () => Promise<T>,
    expectedFingerprint?: string
  ): Promise<T> {
    const { attempt } = await this.repository.claim(
      orgId,
      postId,
      version,
      owner,
      operation,
      occurrence,
      expectedFingerprint
    );
    if (['SUCCEEDED', 'ACCEPTED_PENDING'].includes(attempt.state))
      return JSON.parse(await this.encryption.decrypt(attempt.result!)).value;
    try {
      const result = await action();
      const values = Array.isArray(result) ? result : [result];
      const pending = values.some(
        (value) => value && ['pending', 'ready'].includes(value.status)
      );
      await this.repository.finish(
        attempt.id,
        pending ? 'ACCEPTED_PENDING' : 'SUCCEEDED',
        await this.encryption.encrypt(JSON.stringify({ value: result }))
      );
      return result;
    } catch (error) {
      // An adapter can throw after accepting an earlier item or publishing but failing a thumbnail.
      // Its exception class alone never proves that the provider had no side effects.
      await this.repository.finish(
        attempt.id,
        'UNCERTAIN',
        undefined,
        error instanceof Error ? error.name : 'UnknownError'
      );
      throw error;
    }
  }
  release(orgId: string, owner: string) {
    return this.repository.release(orgId, owner);
  }
  confirmed(orgId: string, postId: string, owner: string) {
    return this.repository.confirmed(orgId, postId, owner);
  }
  list(orgId: string) {
    return this.repository.list(orgId);
  }
  async reconcile(
    orgId: string,
    id: string,
    actorId: string,
    body: ReconcileBrandDeliveryDto
  ) {
    const attempt = await this.repository.uncertain(orgId, id);
    if (!attempt) throw new NotFoundException('Uncertain delivery not found');
    if (Date.now() - attempt.updatedAt.getTime() < 35 * 60_000)
      throw new ConflictException(
        'Wait for the 30 minute provider activity and its safety margin to end before reconciliation'
      );
    const executions = this.temporal.client.getRawClient().workflow.list({
      query: `RunId=${JSON.stringify(
        attempt.owner
      )} AND ExecutionStatus="Running"`,
    });
    for await (const _execution of executions)
      throw new ConflictException(
        'The delivery workflow is still running. Stop it and confirm the native network outcome before reconciliation.'
      );
    if (body.outcome === 'PUBLISHED') {
      if (!body.externalId || !body.releaseUrl)
        throw new BadRequestException(
          'The native post ID and URL are required'
        );
      try {
        if (new URL(body.releaseUrl).protocol !== 'https:') throw new Error();
      } catch {
        throw new BadRequestException('Use the native HTTPS post URL');
      }
    }
    return this.repository.reconcile(
      orgId,
      id,
      actorId,
      body.outcome,
      body.evidence,
      body.externalId,
      body.releaseUrl
    );
  }
}
