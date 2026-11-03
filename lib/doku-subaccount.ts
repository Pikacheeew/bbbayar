import crypto from "crypto";

const BASE_URL = process.env.DOKU_SUBACCOUNT_BASE_URL ?? "https://api-sandbox.doku.com";
const CLIENT_ID = process.env.DOKU_SUBACCOUNT_CLIENT_ID!;
const CLIENT_SECRET = process.env.DOKU_SUBACCOUNT_CLIENT_SECRET!;
const PRIVATE_KEY = process.env.DOKU_SUBACCOUNT_PRIVATE_KEY!;

// B2B token: asymmetric (RSA-SHA256), string-to-sign = "{clientId}|{timestamp}", UTC timestamp.
// https://developers.doku.com/accept-payments/direct-api/snap/integration-guide/get-token-api/b2b
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getB2BToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5_000) return cachedToken.token;

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(`${CLIENT_ID}|${timestamp}`), PRIVATE_KEY)
    .toString("base64");

  const res = await fetch(`${BASE_URL}/authorization/v1/access-token/b2b`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CLIENT-KEY": CLIENT_ID,
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
    },
    body: JSON.stringify({ grantType: "client_credentials" }),
  });
  const data = await res.json();
  if (!res.ok || !data.accessToken) {
    throw new Error(`DOKU token error: ${data.responseMessage ?? res.status}`);
  }

  cachedToken = { token: data.accessToken, expiresAt: Date.now() + data.expiresIn * 1000 };
  return cachedToken.token;
}

// Service calls (register, balance, split-rules, ...): symmetric (HMAC-SHA512), signed with the
// access token from above, per DOKU's SNAP symmetric-signature spec:
// string-to-sign = "{method}:{path}:{accessToken}:{lowercaseHex(sha256(minifiedBody))}:{timestamp}"
function jakartaTimestamp(): string {
  const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${jakarta.toISOString().replace(/\.\d{3}Z$/, "")}+07:00`;
}

let externalIdSeq = 0;
function externalId(): string {
  externalIdSeq += 1;
  return `${Date.now()}${externalIdSeq}`;
}

async function dokuRequest<T>(method: string, path: string, body: unknown): Promise<T> {
  const token = await getB2BToken();
  const timestamp = jakartaTimestamp();
  const minifiedBody = JSON.stringify(body);
  const bodyHash = crypto.createHash("sha256").update(minifiedBody).digest("hex").toLowerCase();
  const stringToSign = `${method}:${path}:${token}:${bodyHash}:${timestamp}`;
  const signature = crypto.createHmac("sha512", CLIENT_SECRET).update(stringToSign).digest("base64");

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-PARTNER-ID": CLIENT_ID,
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "X-EXTERNAL-ID": externalId(),
    },
    body: minifiedBody,
  });
  const data = await res.json();
  if (!res.ok || !`${data.responseCode}`.startsWith("2")) {
    throw new Error(`DOKU ${path} error: ${data.responseMessage ?? res.status}`);
  }
  return data as T;
}

export interface DokuSubAccount {
  profileId: string;
  accountNoIdr: string;
  accountNoPendingIdr: string | null;
}

// https://developers.doku.com/wallet-as-a-service/sub-account/sub-account-v2/integration-guide
export async function registerSubAccount(params: {
  partnerReferenceNo: string;
  email: string;
  name: string;
  phoneNo: string;
}): Promise<DokuSubAccount> {
  const data = await dokuRequest<{
    profileId: string;
    accounts: { type: string; accountNo: string }[];
  }>("POST", "/sub-account/v2.0/register", {
    partnerReferenceNo: params.partnerReferenceNo,
    type: "DEFAULT",
    email: params.email,
    name: params.name,
    phoneNo: params.phoneNo,
    countryCode: "ID",
  });

  const idr = data.accounts.find((a) => a.type === "DOKU_MERCHANT_IDR");
  const pending = data.accounts.find((a) => a.type === "DOKU_MERCHANT_PENDING_IDR");
  if (!idr) throw new Error("DOKU register response missing DOKU_MERCHANT_IDR account");

  return { profileId: data.profileId, accountNoIdr: idr.accountNo, accountNoPendingIdr: pending?.accountNo ?? null };
}

export interface DokuBalance {
  type: string;
  accountNo: string;
  available: string;
  reserved: string;
}

export async function createSplitRule(routes: {
  type: "PERCENTAGE" | "FLAT";
  value: number;
  profileId: string;
  currency?: "IDR";
}[]): Promise<string> {
  const data = await dokuRequest<{ splitRuleId: string }>("POST", "/sub-account/v2.0/split-rules", {
    transactionType: "PAYMENT",
    rules: routes.map((r) => ({
      type: r.type,
      value: r.value,
      accountNumber: r.profileId,
      ...(r.type === "FLAT" ? { currency: r.currency ?? "IDR" } : {}),
    })),
  });
  return data.splitRuleId;
}

export async function getSubAccountBalance(profileId: string, accountNos: string[]): Promise<DokuBalance[]> {
  const data = await dokuRequest<{
    accounts: { type: string; accountNo: string; balance: { available: string; reserved: string } }[];
  }>("POST", "/sub-account/v2.0/balance-inquiries", { profileId, accounts: accountNos });

  return data.accounts.map((a) => ({
    type: a.type,
    accountNo: a.accountNo,
    available: a.balance.available,
    reserved: a.balance.reserved,
  }));
}
