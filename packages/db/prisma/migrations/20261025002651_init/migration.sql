-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('DIRECT_META', 'CREDIT_LINE');

-- CreateEnum
CREATE TYPE "MessageCategory" AS ENUM ('AUTHENTICATION', 'AUTHENTICATION_INTERNATIONAL', 'UTILITY', 'MARKETING', 'SERVICE');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('OUT', 'IN');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('HELD', 'CAPTURED', 'RELEASED');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('TOP_UP', 'PROMO', 'MESSAGE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waba" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "metaWabaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT,
    "reviewStatus" TEXT,
    "billingMode" "BillingMode" NOT NULL DEFAULT 'DIRECT_META',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waba_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneNumber" (
    "id" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "metaPhoneNumberId" TEXT NOT NULL,
    "displayPhoneNumber" TEXT NOT NULL,
    "verifiedName" TEXT,
    "qualityRating" TEXT,
    "status" TEXT,
    "messagingLimitTier" TEXT,
    "pinEncrypted" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "metaTemplateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "components" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL DEFAULT 'OUT',
    "metaMessageId" TEXT,
    "contact" TEXT NOT NULL,
    "country" TEXT,
    "type" TEXT NOT NULL,
    "templateName" TEXT,
    "body" TEXT,
    "category" "MessageCategory",
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "errorCode" INTEGER,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT,
    "reservedMicros" BIGINT NOT NULL DEFAULT 0,
    "reservationStatus" "ReservationStatus" NOT NULL DEFAULT 'RELEASED',
    "billedCategory" "MessageCategory",
    "chargedMicros" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "messageId" TEXT,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "balanceMicros" BIGINT NOT NULL DEFAULT 0,
    "reservedMicros" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "debit" TEXT NOT NULL,
    "credit" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "messageId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "category" "MessageCategory" NOT NULL,
    "country" TEXT NOT NULL,
    "billingMode" "BillingMode" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "priceMicros" BIGINT NOT NULL,
    "metaCostMicros" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_hash_key" ON "ApiKey"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "Waba_metaWabaId_key" ON "Waba"("metaWabaId");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumber_metaPhoneNumberId_key" ON "PhoneNumber"("metaPhoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_metaTemplateId_key" ON "Template"("metaTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_wabaId_name_language_key" ON "Template"("wabaId", "name", "language");

-- CreateIndex
CREATE UNIQUE INDEX "Message_metaMessageId_key" ON "Message"("metaMessageId");

-- CreateIndex
CREATE INDEX "Message_orgId_createdAt_idx" ON "Message"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_orgId_idempotencyKey_key" ON "Message"("orgId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OtpRequest_messageId_key" ON "OtpRequest"("messageId");

-- CreateIndex
CREATE INDEX "OtpRequest_orgId_phone_createdAt_idx" ON "OtpRequest"("orgId", "phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_orgId_key" ON "Wallet"("orgId");

-- CreateIndex
CREATE INDEX "LedgerEntry_walletId_createdAt_idx" ON "LedgerEntry"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rate_plan_category_country_billingMode_effectiveFrom_key" ON "Rate"("plan", "category", "country", "billingMode", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waba" ADD CONSTRAINT "Waba_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_wabaId_fkey" FOREIGN KEY ("wabaId") REFERENCES "Waba"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_wabaId_fkey" FOREIGN KEY ("wabaId") REFERENCES "Waba"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpRequest" ADD CONSTRAINT "OtpRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpRequest" ADD CONSTRAINT "OtpRequest_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
