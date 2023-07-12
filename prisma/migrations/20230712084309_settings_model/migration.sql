-- CreateTable
CREATE TABLE "Settings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "begin_date" TIMESTAMP(3) NOT NULL,
    "initial_balance_hours" INTEGER NOT NULL,
    "initial_balance_mins" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Settings_user_id_key" ON "Settings"("user_id");

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
