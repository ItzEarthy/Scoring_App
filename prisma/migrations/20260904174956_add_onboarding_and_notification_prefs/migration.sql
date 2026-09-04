-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notification_preferences" JSONB,
ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3);

-- Backfill: existing users have already found their way around the app on
-- their own, so mark them as onboarded rather than routing them into the
-- new-user onboarding flow on their next sign-in.
UPDATE "users" SET "onboarding_completed_at" = "created_at" WHERE "onboarding_completed_at" IS NULL;
