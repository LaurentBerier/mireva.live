-- AlterTable
ALTER TABLE "postiz"."BrandDeliveryAttempt" ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reconciledBy" TEXT,
ADD COLUMN     "reconciliation" TEXT;
