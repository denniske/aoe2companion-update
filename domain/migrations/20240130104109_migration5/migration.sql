/*
  Warnings:

  - Added the required column `config` to the `update` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "update" ADD COLUMN     "config" JSONB NOT NULL;
