import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Connection } from '@temporalio/client';
import { getTemporalConnectionOptions } from '@gitroom/nestjs-libraries/temporal/temporal.module';

@Controller('health')
export class HealthController {
  @Get('/status')
  async getHealthStatus(@Res() res: Response) {
    let connection: Connection | undefined;
    try {
      const { namespace, ...connectionOptions } = getTemporalConnectionOptions();
      connection = await Connection.connect(connectionOptions);
      await Promise.race([
        connection.workflowService.describeNamespace({ namespace }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 10000)
        ),
      ]);
      return res.status(200).json({ status: 'ok' });
    } catch {
      return res.status(500).json({ status: 'error' });
    } finally {
      await connection?.close().catch(() => {});
    }
  }
}
