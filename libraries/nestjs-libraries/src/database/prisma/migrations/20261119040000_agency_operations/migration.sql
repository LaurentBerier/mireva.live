-- AlterTable
ALTER TABLE "postiz"."BrandUploadTicket" ADD COLUMN     "mediaId" TEXT;

-- CreateTable
CREATE TABLE "postiz"."BrandSyncRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandSyncRun_organizationId_createdAt_idx" ON "postiz"."BrandSyncRun"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "postiz"."BrandSyncRun" ADD CONSTRAINT "BrandSyncRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "postiz"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
