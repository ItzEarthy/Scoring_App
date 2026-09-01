-- CreateEnum
CREATE TYPE "MatchEventType" AS ENUM ('POINT', 'UNDO', 'MATCH_STARTED');

-- CreateTable
CREATE TABLE "match_events" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "participant_id" TEXT,
    "type" "MatchEventType" NOT NULL,
    "delta" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_events_match_id_created_at_idx" ON "match_events"("match_id", "created_at");

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "match_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
