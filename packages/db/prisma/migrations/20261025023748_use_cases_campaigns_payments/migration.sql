-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('SENDING', 'PAUSED', 'DONE');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "useCase" TEXT;

-- AlterTable
ALTER TABLE "Waba" ADD COLUMN     "accessToken" TEXT;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'SENDING',
    "total" INTEGER NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "status" "RecipientStatus" NOT NULL DEFAULT 'PENDING',
    "messageId" TEXT,
    "error" TEXT,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "creditMicros" BIGINT NOT NULL,
    "gstMicros" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_orgId_phone_key" ON "Contact"("orgId", "phone");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_status_idx" ON "CampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
