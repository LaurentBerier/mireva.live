-- AlterTable
ALTER TABLE "postiz"."BrandConversation" ADD COLUMN     "postExternalId" TEXT;

-- AlterTable
ALTER TABLE "postiz"."BrandReport" ADD COLUMN     "accentColor" TEXT NOT NULL DEFAULT '612BD3',
ADD COLUMN     "logoMediaId" TEXT,
ADD COLUMN     "period" TEXT NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "sourceReportId" TEXT;

-- AlterTable
ALTER TABLE "postiz"."Organization" ADD COLUMN     "publicationFence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "postiz"."BrandDeliveryLease" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandDeliveryLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postiz"."BrandAnalyticsKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "BrandAnalyticsKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postiz"."BrandDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RUNNING',
    "result" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandDeliveryLease_organizationId_group_key" ON "postiz"."BrandDeliveryLease"("organizationId", "group");

-- CreateIndex
CREATE UNIQUE INDEX "BrandAnalyticsKey_tokenHash_key" ON "postiz"."BrandAnalyticsKey"("tokenHash");

-- CreateIndex
CREATE INDEX "BrandDeliveryAttempt_organizationId_group_owner_idx" ON "postiz"."BrandDeliveryAttempt"("organizationId", "group", "owner");

-- CreateIndex
CREATE UNIQUE INDEX "BrandReport_sourceReportId_from_to_key" ON "postiz"."BrandReport"("sourceReportId", "from", "to");

-- AddForeignKey
ALTER TABLE "postiz"."BrandDeliveryLease" ADD CONSTRAINT "BrandDeliveryLease_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "postiz"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postiz"."BrandAnalyticsKey" ADD CONSTRAINT "BrandAnalyticsKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "postiz"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postiz"."BrandDeliveryAttempt" ADD CONSTRAINT "BrandDeliveryAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "postiz"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
