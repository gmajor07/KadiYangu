# Phase 3 — Card Editor MVP

Phase 3 adds an authenticated, browser-side invitation editor. Published templates remain immutable masters; customization clones validated `designData` into a user-owned `Design` record.

## Architecture

`/template/[slug]` uses a server action to authenticate, clone a published template and redirect to `/editor/[designId]`. The editor is a client component using Konva and react-konva. All loads and saves go through server-side ownership checks in `src/services/designs.ts`.

## Design data V1

Data is `{ version: 1, canvas: { width, height, backgroundColor, backgroundImage }, elements: [] }`. Elements are typed text, image, rectangle, circle or line records with logical coordinates. Zod rejects unknown fields, invalid colors, negative dimensions and oversized payloads.

The canvas keeps template coordinates (for example 1080×1350); display scale is calculated in the browser and never persisted.

## Save and security

Save is explicit and reports Saved, Saving, Unsaved changes or Save failed. Mutations require the active session and `userId` is included in every query. Duplicate and archive also enforce ownership. Templates are never updated by editor actions.

## Responsive behavior and limitations

The editor uses a three-panel desktop layout and a stacked mobile layout with a compact toolbar. Current MVP supports text and basic shapes, selection, move, delete, preview, duplicate, archive and save. Image upload, Transformer resize/rotate, advanced layers/history, thumbnails and blank designs are deferred where they need additional storage and UX work.

## cPanel

No Docker, Redis, workers or WebSockets were added. Konva runs in the browser and the existing Node/cPanel process remains sufficient. Run `npm install`, `npx prisma migrate deploy`, then `npm run build`.
