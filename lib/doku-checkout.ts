import crypto from "crypto";

// DOKU Checkout API (order/payment/customer) — a different, older credential and signature
// family than Sub-Account V2 (lib/doku-subaccount.ts). Get Client-Id + Secret Key from
// DOKU Back Office > Integration > API Keys for THIS product specifically.
// https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration
const BASE_URL = process.env.DOKU_CHECKOUT_BASE_URL ?? "https://api-sandbox.doku.com";
const CLIENT_ID = process.env.DOKU_CHECKOUT_CLIENT_ID!;
const SECRET_KEY = process.env.DOKU_CHECKOUT_SECRET_KEY!;

// Non-SNAP signature: HMAC-SHA256 over "Client-Id:..\nRequest-Id:..\nRequest-Timestamp:..\nRequest-Target:..\nDigest:..",
// prefixed "HMACSHA256=". Digest = base64(sha256(minified JSON body)).
// https://developers.doku.com/get-started-with-doku-api/signature-component/non-snap/signature-component-from-request-header
function signRequest(path: string, body: unknown) {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const minifiedBody = JSON.stringify(body);
  const digest = crypto.createHash("sha256").update(minifiedBody).digest("base64");

  const stringToSign = [
    `Client-Id:${CLIENT_ID}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${path}`,
    `Digest:${digest}`,
  ].join("\n");

  const signature = `HMACSHA256=${crypto.createHmac("sha256", SECRET_KEY).update(stringToSign).digest("base64")}`;

  return {
    body: minifiedBody,
    headers: {
      "Content-Type": "application/json",
      "Client-Id": CLIENT_ID,
      "Request-Id": requestId,
      "Request-Timestamp": timestamp,
      Signature: signature,
    },
  };
}

export interface CheckoutPayment {
  invoiceNumber: string;
  paymentUrl: string;
  tokenId: string;
}

/**
 * Creates a payment that settles into one organizer's DOKU sub-account.
 *
 * The `additionalInfo.account` field isn't in DOKU's written API reference — it's confirmed
 * directly from DOKU's own interactive sandbox demo (sandbox.doku.com/demo/sub-account,
 * Marketplace scenario), which showed this literal request shape against their real sandbox.
 * One thing that demo left ambiguous: it renders the wrapper as camelCase `additionalInfo`,
 * while DOKU's written docs use snake_case `additional_info` for the same top-level field on
 * every other option. Verify this against a real sandbox call once credentials exist — if
 * `additionalInfo` (camelCase) doesn't route the payment, try `additional_info` instead.
 */
export async function createCheckoutPayment(params: {
  invoiceNumber: string;
  amount: number;
  subAccountProfileId: string;
  splitRuleId?: string;
  paymentMethodTypes: string[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  callbackUrl: string;
}): Promise<CheckoutPayment> {
  const path = "/checkout/v1/payment";
  const { headers, body } = signRequest(path, {
    order: {
      amount: params.amount,
      invoice_number: params.invoiceNumber,
      currency: "IDR",
      callback_url: params.callbackUrl,
    },
    payment: {
      payment_due_date: 60,
      payment_method_types: params.paymentMethodTypes,
    },
    customer: {
      id: params.subAccountProfileId,
      name: params.customerName,
      email: params.customerEmail,
      phone: params.customerPhone,
    },
    additionalInfo: {
      account: {
        id: params.subAccountProfileId,
        ...(params.splitRuleId ? { split_rule_id: params.splitRuleId } : {}),
      },
    },
  });

  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body });
  const data = await res.json();
  if (!res.ok || !data.response) {
    throw new Error(`DOKU checkout payment error: ${data.message ?? res.status}`);
  }

  return {
    invoiceNumber: data.response.order.invoice_number,
    paymentUrl: data.response.payment.url,
    tokenId: data.response.payment.token_id,
  };
}
