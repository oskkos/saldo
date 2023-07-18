-- CreateEnum
CREATE TYPE "Absence" AS ENUM ('holiday', 'flex_hours', 'sick_leave', 'other');

-- AlterTable
ALTER TABLE "Worklog" ADD COLUMN     "absence" "Absence";
