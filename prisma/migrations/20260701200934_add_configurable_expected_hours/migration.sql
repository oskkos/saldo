-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "expected_minutes_per_day" INTEGER NOT NULL DEFAULT 450;

-- CreateTable
CREATE TABLE "ExpectedHoursOverride" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpectedHoursOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpectedHoursOverride_user_id_date_key" ON "ExpectedHoursOverride"("user_id", "date");

-- AddForeignKey
ALTER TABLE "ExpectedHoursOverride" ADD CONSTRAINT "ExpectedHoursOverride_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
