-- Player ratings become global per (user, sport) instead of per (user, org, sport).
-- Existing org-scoped ratings are reset to the sport's default rather than merged,
-- since a user could hold conflicting ratings across orgs today.
TRUNCATE TABLE "player_ratings";

-- DropForeignKey
ALTER TABLE "player_ratings" DROP CONSTRAINT "player_ratings_organization_id_fkey";

-- DropIndex
DROP INDEX "player_ratings_user_id_organization_id_sport_id_key";

-- AlterTable
ALTER TABLE "player_ratings" DROP COLUMN "organization_id";

-- CreateIndex
CREATE UNIQUE INDEX "player_ratings_user_id_sport_id_key" ON "player_ratings"("user_id", "sport_id");
