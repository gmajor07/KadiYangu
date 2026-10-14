CREATE TYPE "EventStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE "RsvpStatus" AS ENUM ('ATTENDING','NOT_ATTENDING','MAYBE');
CREATE TABLE "Event" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "designId" TEXT NOT NULL, "title" VARCHAR(160) NOT NULL,
 "slug" VARCHAR(180) NOT NULL, "eventType" VARCHAR(60) NOT NULL, "eventDate" TIMESTAMP(3) NOT NULL,
 "startTime" VARCHAR(10), "endTime" VARCHAR(10), "venue" VARCHAR(160), "locationText" VARCHAR(240),
 "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION, "description" VARCHAR(2000),
 "status" "EventStatus" NOT NULL DEFAULT 'DRAFT', "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_userId_status_idx" ON "Event"("userId","status");
CREATE TABLE "Rsvp" (
 "id" TEXT NOT NULL, "eventId" TEXT NOT NULL, "guestName" VARCHAR(120) NOT NULL, "phone" VARCHAR(30), "email" VARCHAR(254),
 "status" "RsvpStatus" NOT NULL, "guestCount" INTEGER NOT NULL DEFAULT 1, "message" VARCHAR(1000), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Rsvp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Rsvp_eventId_createdAt_idx" ON "Rsvp"("eventId","createdAt");
CREATE INDEX "Rsvp_eventId_email_idx" ON "Rsvp"("eventId","email");
CREATE INDEX "Rsvp_eventId_phone_idx" ON "Rsvp"("eventId","phone");
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
