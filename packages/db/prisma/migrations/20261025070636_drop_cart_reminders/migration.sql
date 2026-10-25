-- DropForeignKey
ALTER TABLE "CartReminder" DROP CONSTRAINT "CartReminder_orgId_fkey";

-- AlterTable
ALTER TABLE "StoreConnection" DROP COLUMN "cartReminder";

-- DropTable
DROP TABLE "CartReminder";

