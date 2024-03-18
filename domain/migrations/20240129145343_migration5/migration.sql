/*
  Warnings:

  - The primary key for the `asset` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "asset" DROP CONSTRAINT "asset_pkey",
ADD CONSTRAINT "asset_pkey" PRIMARY KEY ("update_id", "file_id", "platform");
