-- CreateTable
CREATE TABLE "postiz"."BrandImport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RUNNING',
    "results" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandImport_organizationId_requestId_key" ON "postiz"."BrandImport"("organizationId", "requestId");

-- AddForeignKey
ALTER TABLE "postiz"."BrandImport" ADD CONSTRAINT "BrandImport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "postiz"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
