import "server-only";
export type PaymentOutcome = "SUCCESS" | "FAILED" | "PENDING";
export type PaymentRequest = { amount: number; currency: string; provider: "MPESA" | "MIX_BY_YAS" | "AIRTEL_MONEY"; phoneNumber?: string; outcome: PaymentOutcome };
export type PaymentResult = { status: PaymentOutcome; transactionReference: string };
export interface PaymentProviderAdapter { initiate(request: PaymentRequest): Promise<PaymentResult>; }
export class MockPaymentProvider implements PaymentProviderAdapter { async initiate(request: PaymentRequest) { return { status: request.outcome, transactionReference: `KY-PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}` }; } }
export function normalizeTanzanianPhone(value: string) { const digits = value.replace(/[^0-9+]/g, ""); if (/^\+2557\d{8}$/.test(digits)) return digits.slice(1); if (/^2557\d{8}$/.test(digits)) return digits; if (/^07\d{8}$/.test(digits)) return `255${digits.slice(1)}`; throw new Error("Enter a valid Tanzanian mobile number."); }
