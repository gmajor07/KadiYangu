ALTER TABLE "Rsvp" ADD COLUMN "guestId" TEXT;
CREATE INDEX "Rsvp_guestId_idx" ON "Rsvp"("guestId");
CREATE UNIQUE INDEX "Rsvp_eventId_guestId_key" ON "Rsvp"("eventId", "guestId");
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
