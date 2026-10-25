-- AlterEnum
ALTER TYPE "LedgerKind" ADD VALUE 'SUBSCRIPTION';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "planCancelled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planRenewsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StoreConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "secret" TEXT,
    "sendConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "codConfirm" BOOLEAN NOT NULL DEFAULT true,
    "sendShipped" BOOLEAN NOT NULL DEFAULT true,
    "sendDelivered" BOOLEAN NOT NULL DEFAULT true,
    "cartReminder" BOOLEAN NOT NULL DEFAULT false,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerName" TEXT,
    "phone" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "cod" BOOLEAN NOT NULL DEFAULT false,
    "codStatus" TEXT,
    "confirmMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartReminder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "url" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreConnection_token_key" ON "StoreConnection"("token");

-- CreateIndex
CREATE UNIQUE INDEX "StoreConnection_orgId_platform_key" ON "StoreConnection"("orgId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "Order_confirmMessageId_key" ON "Order"("confirmMessageId");

-- CreateIndex
CREATE INDEX "Order_orgId_createdAt_idx" ON "Order"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orgId_source_externalId_key" ON "Order"("orgId", "source", "externalId");

-- CreateIndex
CREATE INDEX "CartReminder_status_sendAt_idx" ON "CartReminder"("status", "sendAt");

-- CreateIndex
CREATE UNIQUE INDEX "CartReminder_orgId_source_checkoutId_key" ON "CartReminder"("orgId", "source", "checkoutId");

-- AddForeignKey
ALTER TABLE "StoreConnection" ADD CONSTRAINT "StoreConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartReminder" ADD CONSTRAINT "CartReminder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Lock new tables against the Supabase Data API (see enable_rls migration)
ALTER TABLE "StoreConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CartReminder" ENABLE ROW LEVEL SECURITY;
