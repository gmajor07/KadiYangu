# Phase 5 Events & RSVP

Migration `20260928160000_phase5_events_rsvp` is applied to local PostgreSQL only; production/cPanel is not migrated. Events belong to an authenticated user and one owned Design. Lifecycle: DRAFT -> PUBLISHED -> DRAFT or ARCHIVED. Only published events resolve at `/i/[slug]`.

Routes: `/dashboard/events`, `/dashboard/events/new`, `/dashboard/events/[eventId]`, `/dashboard/events/[eventId]/edit`, and public `/i/[slug]`. Dashboard management verifies ownership and keeps RSVP responses private. Public guests need no account. RSVP submissions validate fields, accept attendance and guest count, and update an existing response for the same event/contact instead of creating an obvious duplicate. A small database-backed rate limit protects repeated submissions.

Public invitations render the saved design thumbnail, event details, countdown, location text, maps search link where available, WhatsApp share and clipboard copy. Metadata follows `SITE_INDEXABLE`; public pages do not expose users, orders, payments or RSVP lists. The UI is mobile-first and uses no Redis, workers, external maps API or messaging API. cPanel production migration remains a separate deployment step.
