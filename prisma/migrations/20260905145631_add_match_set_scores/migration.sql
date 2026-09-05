-- AlterTable
ALTER TABLE "match_participants" ADD COLUMN     "set_scores" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
