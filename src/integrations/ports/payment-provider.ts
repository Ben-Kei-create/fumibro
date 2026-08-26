export type CheckoutRequest = Readonly<{
  orderId: string;
  amount: number;
  currency: "jpy";
  returnUrl: string;
}>;

/** Payment and order fulfillment are intentionally unavailable in Phase 1. */
export interface PaymentProvider {
  createCheckout(request: CheckoutRequest): Promise<{ redirectUrl: string }>;
}
