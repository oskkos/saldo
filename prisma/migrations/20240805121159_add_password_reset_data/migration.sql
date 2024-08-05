-- CreateTable
CREATE TABLE "PasswordResetData" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetData_user_id_key" ON "PasswordResetData"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetData_token_key" ON "PasswordResetData"("token");

-- AddForeignKey
ALTER TABLE "PasswordResetData" ADD CONSTRAINT "PasswordResetData_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
