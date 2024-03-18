-- CreateTable
CREATE TABLE "update" (
    "update_id" TEXT NOT NULL,
    "runtime_version" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "update_pkey" PRIMARY KEY ("update_id")
);

-- CreateTable
CREATE TABLE "asset" (
    "update_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "launch_asset" BOOLEAN NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("update_id","file_id")
);

-- CreateTable
CREATE TABLE "file" (
    "file_id" TEXT NOT NULL,
    "presigned" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_pkey" PRIMARY KEY ("file_id")
);

-- CreateIndex
CREATE INDEX "IDX_935515e6126c1a045608ca78b9" ON "update"("runtime_version");

-- CreateIndex
CREATE INDEX "IDX_ke5ie28aa98207f3a21145feb8" ON "update"("created_at");

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "update"("update_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file"("file_id") ON DELETE RESTRICT ON UPDATE CASCADE;
