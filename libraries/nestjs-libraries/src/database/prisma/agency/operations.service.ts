import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AgencyOperationsRepository } from './operations.repository';
import { createReadStream, existsSync } from 'fs';
import { resolve } from 'path';
@Injectable()
export class AgencyOperationsService {
  constructor(private readonly repository: AgencyOperationsRepository) {}
  async ready() {
    try {
      await this.repository.ready();
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }
  async summary(orgId: string) {
    return {
      ...(await this.repository.summary(orgId)),
      maintenanceEnabled: process.env.RUN_AGENCY_SYNC === 'true',
      publishingEnabled: process.env.PUBLISHING_ENABLED === 'true',
    };
  }
  source() {
    const path = resolve(process.cwd(), 'deploy/corresponding-source.tar.gz');
    if (!existsSync(path))
      throw new ServiceUnavailableException(
        'The source bundle must be generated before releasing this deployment'
      );
    return createReadStream(path);
  }
}
