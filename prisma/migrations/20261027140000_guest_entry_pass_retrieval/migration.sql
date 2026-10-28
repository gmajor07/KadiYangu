-- Additive only. Do not infer guest ownership from legacy names or contacts.
ALTER TABLE "GuestPass" ADD COLUMN "guestId" TEXT,
  ADD COLUMN "guestSlot" INTEGER,
  ADD COLUMN "tokenEnvelope" TEXT;
CREATE UNIQUE INDEX "Guest_id_eventId_key" ON "Guest"("id","eventId");
CREATE UNIQUE INDEX "GuestPass_guestId_guestSlot_key" ON "GuestPass"("guestId","guestSlot");
CREATE INDEX "GuestPass_eventId_guestId_idx" ON "GuestPass"("eventId","guestId");
ALTER TABLE "GuestPass" ADD CONSTRAINT "GuestPass_guestId_eventId_fkey"
 FOREIGN KEY ("guestId","eventId") REFERENCES "Guest"("id","eventId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuestPass" ADD CONSTRAINT "GuestPass_guest_slot_valid"
 CHECK (("guestId" IS NULL AND "guestSlot" IS NULL) OR ("guestId" IS NOT NULL AND "guestSlot" IS NOT NULL AND "guestSlot" >= 1));
