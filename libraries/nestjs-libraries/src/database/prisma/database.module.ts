import { Global, Module } from '@nestjs/common';
import { WorkspaceRepository } from './agency/workspace.repository';
import { WorkspaceService } from './agency/workspace.service';
import { SupabaseIdentityService } from './agency/supabase.identity.service';
import { ReviewRepository } from './agency/review.repository';
import { ReviewService } from './agency/review.service';
import { AgencyImportService } from './agency/import.service';
import { AgencyImportRepository } from './agency/import.repository';
import { AgencyOperationsRepository } from './agency/operations.repository';
import { AgencyOperationsService } from './agency/operations.service';
import { AgencyDeliveryRepository } from './agency/delivery.repository';
import { AgencyDeliveryService } from './agency/delivery.service';
import { AgencyMediaRepository } from './agency/media.repository';
import { AgencyMediaService } from './agency/media.service';
import { AgencyAnalyticsRepository } from './agency/analytics.repository';
import { AgencyAnalyticsService } from './agency/analytics.service';
import { CompetitorManager } from '@gitroom/nestjs-libraries/integrations/competitors/competitor.manager';
import { AgencyReportRepository } from './agency/report.repository';
import { AgencyReportService } from './agency/report.service';
import { AgencyGrowthRepository } from './agency/growth.repository';
import { AgencyGrowthService } from './agency/growth.service';
import { AgencyInboxRepository } from './agency/inbox.repository';
import { AgencyInboxService } from './agency/inbox.service';
import { EngagementManager } from '@gitroom/nestjs-libraries/integrations/engagement/engagement.manager';
import { AdvertisingManager } from '@gitroom/nestjs-libraries/integrations/advertising/advertising.manager';
import { AgencyAdvertisingRepository } from './agency/advertising.repository';
import { AgencyAdvertisingService } from './agency/advertising.service';
import { PrismaRepository, PrismaService, PrismaTransaction } from './prisma.service';
import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { UsersRepository } from '@gitroom/nestjs-libraries/database/prisma/users/users.repository';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { SubscriptionRepository } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.repository';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { PostsRepository } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.repository';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';
import { NotificationsRepository } from '@gitroom/nestjs-libraries/database/prisma/notifications/notifications.repository';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { EncryptionService } from '@gitroom/nestjs-libraries/services/encryption.service';
import { StripeService } from '@gitroom/nestjs-libraries/services/stripe.service';
import { PaymentService } from '@gitroom/nestjs-libraries/services/payment/payment.service';
import { PaymentProviderManager } from '@gitroom/nestjs-libraries/services/payment/payment.provider.manager';
import { RevenueCatProvider } from '@gitroom/nestjs-libraries/services/payment/providers/revenuecat.provider';
import { AttributionService } from '@gitroom/nestjs-libraries/services/attribution/attribution.service';
import { AttributionProviderManager } from '@gitroom/nestjs-libraries/services/attribution/attribution.provider.manager';
import { LeadJourneyProvider } from '@gitroom/nestjs-libraries/services/attribution/providers/leadjourney.provider';
import { ExtractContentService } from '@gitroom/nestjs-libraries/openai/extract.content.service';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { DeepgramService } from '@gitroom/nestjs-libraries/deepgram/deepgram.service';
import { ClippingService } from '@gitroom/nestjs-libraries/database/prisma/clipping/clipping.service';
import { ClippingRepository } from '@gitroom/nestjs-libraries/database/prisma/clipping/clipping.repository';
import { AgenciesService } from '@gitroom/nestjs-libraries/database/prisma/agencies/agencies.service';
import { AgenciesRepository } from '@gitroom/nestjs-libraries/database/prisma/agencies/agencies.repository';
import { TrackService } from '@gitroom/nestjs-libraries/track/track.service';
import { ShortLinkService } from '@gitroom/nestjs-libraries/short-linking/short.link.service';
import { WebhooksRepository } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.repository';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { SignatureRepository } from '@gitroom/nestjs-libraries/database/prisma/signatures/signature.repository';
import { SignatureService } from '@gitroom/nestjs-libraries/database/prisma/signatures/signature.service';
import { AutopostRepository } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.repository';
import { AutopostService } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service';
import { SetsService } from '@gitroom/nestjs-libraries/database/prisma/sets/sets.service';
import { SetsRepository } from '@gitroom/nestjs-libraries/database/prisma/sets/sets.repository';
import { ThirdPartyRepository } from '@gitroom/nestjs-libraries/database/prisma/third-party/third-party.repository';
import { ThirdPartyService } from '@gitroom/nestjs-libraries/database/prisma/third-party/third-party.service';
import { VideoManager } from '@gitroom/nestjs-libraries/videos/video.manager';
import { FalService } from '@gitroom/nestjs-libraries/openai/fal.service';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { OAuthRepository } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.repository';
import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';
import { AnnouncementsRepository } from '@gitroom/nestjs-libraries/database/prisma/announcements/announcements.repository';
import { AnnouncementsService } from '@gitroom/nestjs-libraries/database/prisma/announcements/announcements.service';
import { ErrorsRepository } from '@gitroom/nestjs-libraries/database/prisma/errors/errors.repository';
import { ErrorsService } from '@gitroom/nestjs-libraries/database/prisma/errors/errors.service';
import { AdminStatsRepository } from '@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.repository';
import { AdminStatsService } from '@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.service';

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [
    WorkspaceRepository,
    WorkspaceService,
    SupabaseIdentityService,
    ReviewRepository,
    ReviewService,
    AgencyImportRepository,
    AgencyImportService,
    AgencyOperationsRepository,
    AgencyOperationsService,
    AgencyDeliveryRepository,
    AgencyDeliveryService,
    AgencyMediaRepository,
    AgencyMediaService,
    AgencyAnalyticsRepository,
    AgencyAnalyticsService,
    CompetitorManager,
    AgencyReportRepository,
    AgencyReportService,
    AgencyGrowthRepository,
    AgencyGrowthService,
    AgencyInboxRepository,
    AgencyInboxService,
    EngagementManager,
    AdvertisingManager,
    AgencyAdvertisingRepository,
    AgencyAdvertisingService,
    PrismaService,
    PrismaRepository,
    PrismaTransaction,
    UsersService,
    UsersRepository,
    OrganizationService,
    OrganizationRepository,
    SubscriptionService,
    SubscriptionRepository,
    NotificationService,
    NotificationsRepository,
    WebhooksRepository,
    WebhooksService,
    IntegrationService,
    IntegrationRepository,
    PostsService,
    PostsRepository,
    StripeService,
    PaymentService,
    PaymentProviderManager,
    RevenueCatProvider,
    AttributionService,
    AttributionProviderManager,
    LeadJourneyProvider,
    SignatureRepository,
    AutopostRepository,
    AutopostService,
    SignatureService,
    MediaService,
    MediaRepository,
    AgenciesService,
    AgenciesRepository,
    IntegrationManager,
    RefreshIntegrationService,
    ExtractContentService,
    OpenaiService,
    DeepgramService,
    ClippingService,
    ClippingRepository,
    FalService,
    EmailService,
    EncryptionService,
    TrackService,
    ShortLinkService,
    SetsService,
    SetsRepository,
    ThirdPartyRepository,
    ThirdPartyService,
    OAuthRepository,
    OAuthService,
    VideoManager,
    AnnouncementsRepository,
    AnnouncementsService,
    ErrorsRepository,
    ErrorsService,
    AdminStatsRepository,
    AdminStatsService,
  ],
  get exports() {
    return this.providers;
  },
})
export class DatabaseModule {}
