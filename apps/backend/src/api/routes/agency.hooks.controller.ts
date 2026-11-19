import { UsePipes, ValidationPipe } from '@nestjs/common';
import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { AgencyInboxService } from '@gitroom/nestjs-libraries/database/prisma/agency/inbox.service';
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })
)
@Controller('/agency-hooks')
export class AgencyHooksController {
  constructor(private readonly inbox: AgencyInboxService) {}
  @Get('/meta') verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string
  ) {
    if (
      mode !== 'subscribe' ||
      !process.env.META_WEBHOOK_VERIFY_TOKEN ||
      token !== process.env.META_WEBHOOK_VERIFY_TOKEN
    )
      throw new ForbiddenException();
    return challenge;
  }
  @Post('/meta') async event(@Req() request: RawBodyRequest<Request>) {
    const secrets = [
      process.env.FACEBOOK_APP_SECRET,
      process.env.INSTAGRAM_APP_SECRET,
    ].filter(Boolean) as string[];
    if (!secrets.length) throw new ServiceUnavailableException();
    const signature = request.get('x-hub-signature-256') || '';
    if (
      !request.rawBody ||
      !secrets.some((secret) => {
        const expected = Buffer.from(
          'sha256=' +
            createHmac('sha256', secret).update(request.rawBody!).digest('hex')
        );
        const actual = Buffer.from(signature);
        return (
          actual.length === expected.length && timingSafeEqual(actual, expected)
        );
      })
    )
      throw new ForbiddenException();
    return this.inbox.metaWebhook(request.body);
  }
}
