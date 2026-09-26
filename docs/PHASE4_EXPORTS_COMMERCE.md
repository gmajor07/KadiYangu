# Phase 4 — Export and Commercial Foundation

Phase 4 adds client-side PNG, JPG and PDF export and the server-side commerce foundation. Export uses the Konva stage and preserves logical canvas dimensions. Standard exports carry a `Created with KadiYangu` watermark; high-resolution is presented as a future premium capability and is never authorized by a client flag.

The Prisma migration `20260926092810_phase4_exports_commerce` adds `Order`, `Payment`, `Entitlement` and `ExportRecord`, plus order/payment/status/provider enums. Money is stored as integer TZS whole units, matching the existing catalog convention. Orders are created server-side from the design owner and centralized export price policy; browser totals are not trusted.

`PaymentProvider` is an abstraction enum for MIX_BY_YAS, MPESA, AIRTEL_MONEY, CARD and MANUAL_TEST. No provider API calls, payment confirmations or secrets are implemented. Checkout is explicitly a placeholder. Premium access is represented by an `Entitlement` with `PREMIUM_EXPORT`, scoped to a user and design. Export records store metadata only, never binary files.

Routes added are `/dashboard/orders`, `/checkout/[orderId]`, `/admin/orders` and `/admin/payments`. Every route uses server-side user/admin guards. Standalone cPanel packaging remains unchanged and no Prisma CLI is needed at runtime.

Deferred: real payment providers, final entitlement purchase callbacks, server-side export audit recording, advanced export queues, subscriptions and all later event features.
