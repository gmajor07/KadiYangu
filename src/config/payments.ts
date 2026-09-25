// Future compatibility only. No gateways, credentials, or purchase models.
export const paymentProviders = [
  "MIXx_BY_YAS",
  "MPESA",
  "AIRTEL_MONEY",
  "CARD",
  "OTHER",
] as const;
export type PaymentProvider = (typeof paymentProviders)[number];
