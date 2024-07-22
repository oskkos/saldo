-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "from_default" TEXT NOT NULL DEFAULT '08:00',
ADD COLUMN     "to_default" TEXT NOT NULL DEFAULT '16:00';
