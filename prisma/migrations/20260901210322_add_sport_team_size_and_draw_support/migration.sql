-- Sport team-size constraints: express both "exact size" (singles=1/1,
-- doubles=2/2) and "minimum, no max" (team sports=N/null) so team formation
-- and the rating-algorithm choice (Glicko-2 only for size <= 2) can be
-- validated structurally instead of by sport name.
-- AlterTable
ALTER TABLE "sports" ADD COLUMN     "max_team_size" INTEGER,
ADD COLUMN     "min_team_size" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "sports" ADD CONSTRAINT "sports_min_team_size_check" CHECK ("min_team_size" >= 1);
ALTER TABLE "sports" ADD CONSTRAINT "sports_max_team_size_check" CHECK ("max_team_size" IS NULL OR "max_team_size" >= "min_team_size");

-- Draw support: player_mutual score reports need a way to represent "both
-- sides agree there's no winner" distinct from "not yet reported" (NULL
-- reported_winner_team already means the latter).
-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "reported_is_draw" BOOLEAN NOT NULL DEFAULT false;

-- Data correction: Badminton and Pickleball move from OpenSkill to Glicko-2
-- as part of the singles/doubles catalog split (see prisma/seed.ts). Any
-- ratings already recorded for these sports were computed on OpenSkill's
-- mu~25/sigma~8.3 scale and are meaningless on Glicko-2's mu~1500/sigma~350
-- scale -- reset them to the Glicko-2 default, same precedent as the
-- TRUNCATE in 20260901192253_make_player_ratings_global. Historical
-- MatchParticipant ledger rows are untouched (immutable history).
UPDATE "player_ratings" SET "mu" = 1500, "sigma" = 350
WHERE "sport_id" IN (SELECT "id" FROM "sports" WHERE "name" IN ('Badminton', 'Pickleball'));
