-- CreateEnum
CREATE TYPE "CourtStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'DISABLED');

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "court_id" TEXT;

-- CreateTable
CREATE TABLE "organization_sports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sport_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sport_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "CourtStatus" NOT NULL DEFAULT 'AVAILABLE',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_sports_organization_id_sport_id_key" ON "organization_sports"("organization_id", "sport_id");

-- CreateIndex
CREATE INDEX "courts_organization_id_display_order_idx" ON "courts"("organization_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "courts_organization_id_name_key" ON "courts"("organization_id", "name");

-- AddForeignKey
ALTER TABLE "organization_sports" ADD CONSTRAINT "organization_sports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_sports" ADD CONSTRAINT "organization_sports_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing organization implicitly had access to every active
-- sport before this join table existed. Seed one row per (org, active sport)
-- pair so no org silently loses sports it already uses once enablement
-- becomes opt-in.
INSERT INTO "organization_sports" ("id", "organization_id", "sport_id", "created_at")
SELECT gen_random_uuid()::text, o."id", s."id", CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN "sports" s
WHERE s."is_active" = true;
