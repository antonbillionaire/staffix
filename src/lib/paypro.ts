// PayPro Global payment integration helper
// Docs: https://developers.payproglobal.com/

import { createHash } from "crypto";
import { type PlanId } from "./plans";

// Environment variables
const PAYPRO_VENDOR_ACCOUNT_ID = process.env.PAYPRO_VENDOR_ACCOUNT_ID || "";
const PAYPRO_API_SECRET_KEY = process.env.PAYPRO_API_SECRET_KEY || "";
const PAYPRO_IPN_SECRET_KEY = process.env.PAYPRO_IPN_SECRET_KEY || "";
const PAYPRO_VALIDATION_KEY = process.env.PAYPRO_VALIDATION_KEY || "";
const PAYPRO_TEST_MODE = process.env.PAYPRO_TEST_MODE === "true";
const PAYPRO_CHECKOUT_BASE_URL = "https://store.payproglobal.com/checkout";
const PAYPRO_API_BASE_URL = "https://store.payproglobal.com/api";

// PayPro whitelisted IPs for webhook verification
const PAYPRO_IPS = [
  "198.199.123.239",
  "157.230.8.40",
];

// Product ID mapping: plan + billing period → PayPro Product ID
// These will be set from environment variables after PayPro provides them
const PRODUCT_IDS: Record<string, string> = {
  "starter_monthly": process.env.PAYPRO_PRODUCT_STARTER_MONTHLY || "",
  "starter_yearly": process.env.PAYPRO_PRODUCT_STARTER_YEARLY || "",
  "pro_monthly": process.env.PAYPRO_PRODUCT_PRO_MONTHLY || "",
  "pro_yearly": process.env.PAYPRO_PRODUCT_PRO_YEARLY || "",
  "business_monthly": process.env.PAYPRO_PRODUCT_BUSINESS_MONTHLY || "",
  "business_yearly": process.env.PAYPRO_PRODUCT_BUSINESS_YEARLY || "",
  "enterprise_monthly": process.env.PAYPRO_PRODUCT_ENTERPRISE_MONTHLY || "",
  "enterprise_yearly": process.env.PAYPRO_PRODUCT_ENTERPRISE_YEARLY || "",
};

// Message pack product IDs (one-time purchase)
const PACK_PRODUCT_IDS: Record<string, string> = {
  "pack_100": process.env.PAYPRO_PRODUCT_PACK_100 || "",
  "pack_500": process.env.PAYPRO_PRODUCT_PACK_500 || "",
  "pack_1000": process.env.PAYPRO_PRODUCT_PACK_1000 || "",
};

// Get PayPro product ID for a plan
export function getProductId(planId: PlanId, billingPeriod: "monthly" | "yearly"): string {
  const key = `${planId}_${billingPeriod}`;
  return PRODUCT_IDS[key] || "";
}

// Get PayPro product ID for a message pack
export function getPackProductId(packId: string): string {
  return PACK_PRODUCT_IDS[packId] || "";
}

// Build checkout URL for a message pack (one-time purchase)
export function buildPackCheckoutUrl(params: {
  productId: string;
  email?: string;
  firstName?: string;
  userId: string;
  packId: string;
  language?: string;
  currency?: string;
}): string {
  const url = new URL(PAYPRO_CHECKOUT_BASE_URL);

  url.searchParams.set("products[1][id]", params.productId);

  if (params.email) {
    url.searchParams.set("billing-email", params.email);
  }
  if (params.firstName) {
    url.searchParams.set("billing-first-name", params.firstName);
  }

  const langMap: Record<string, string> = {
    ru: "RU",
    en: "EN",
    uz: "EN",
    kz: "RU",
  };
  url.searchParams.set("language", langMap[params.language || "ru"] || "EN");

  if (params.currency) {
    url.searchParams.set("currency", params.currency);
  }

  // Custom parameters
  url.searchParams.set("x-userId", params.userId);
  url.searchParams.set("x-packId", params.packId);
  url.searchParams.set("x-billingPeriod", "one-time");

  // Success URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.staffix.io";
  url.searchParams.set("success-url", `${appUrl}/dashboard?payment=success`);

  if (PAYPRO_TEST_MODE) {
    url.searchParams.set("use-test-mode", "true");
    url.searchParams.set("secret-key", PAYPRO_IPN_SECRET_KEY);
  }

  return url.toString();
}

// Build checkout URL for a subscription
export function buildCheckoutUrl(params: {
  productId: string;
  email?: string;
  firstName?: string;
  userId: string;
  planId: string;
  billingPeriod: string;
  language?: string;
  currency?: string;
  successUrl?: string;
}): string {
  const url = new URL(PAYPRO_CHECKOUT_BASE_URL);

  // Product
  url.searchParams.set("products[1][id]", params.productId);

  // Customer info
  if (params.email) {
    url.searchParams.set("billing-email", params.email);
  }
  if (params.firstName) {
    url.searchParams.set("billing-first-name", params.firstName);
  }

  // Language mapping
  const langMap: Record<string, string> = {
    ru: "RU",
    en: "EN",
    uz: "EN", // Uzbek not available, fallback to English
    kz: "RU", // Kazakh not available, fallback to Russian
  };
  url.searchParams.set("language", langMap[params.language || "ru"] || "EN");

  // Currency
  if (params.currency) {
    url.searchParams.set("currency", params.currency);
  }

  // Custom parameters (passed through to webhook)
  url.searchParams.set("x-userId", params.userId);
  url.searchParams.set("x-planId", params.planId);
  url.searchParams.set("x-billingPeriod", params.billingPeriod);

  // Success/cancel URLs
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.staffix.io";
  url.searchParams.set("success-url", params.successUrl || `${appUrl}/dashboard?payment=success`);

  // Test mode
  if (PAYPRO_TEST_MODE) {
    url.searchParams.set("use-test-mode", "true");
    url.searchParams.set("secret-key", PAYPRO_IPN_SECRET_KEY);
  }

  return url.toString();
}

// IPN event types
export const IPN_TYPES = {
  ORDER_CHARGED: "1",
  ORDER_REFUNDED: "2",
  ORDER_CHARGED_BACK: "3",
  ORDER_DECLINED: "4",
  ORDER_PARTIALLY_REFUNDED: "5",
  SUBSCRIPTION_CHARGE_SUCCEED: "6",
  SUBSCRIPTION_CHARGE_FAILED: "7",
  SUBSCRIPTION_SUSPENDED: "8",
  SUBSCRIPTION_RENEWED: "9",
  SUBSCRIPTION_TERMINATED: "10",
  SUBSCRIPTION_FINISHED: "11",
  LICENSE_REQUEST: "12",
  TRIAL_CHARGE: "13",
  ORDER_CHARGEBACK_WON: "14",
  ORDER_CUSTOMER_INFO_CHANGED: "15",
  ORDER_ON_WAITING: "17",
  SUBSCRIPTION_PAYMENT_INFO_CHANGED: "21",
} as const;

// Parsed IPN data from PayPro webhook
export interface PayProIPN {
  ipnTypeId: string;
  ipnTypeName: string;
  testMode: boolean;
  orderId: string;
  orderStatus: string;
  orderTotalAmount: string;
  orderCurrency: string;
  customerId: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  productId: string;
  subscriptionId: string;
  subscriptionStatus: string;
  subscriptionNextChargeDate: string;
  subscriptionNextChargeAmount: string;
  hash: string;
  signature: string;
  // Custom fields
  userId: string;
  planId: string;
  billingPeriod: string;
  packId: string;
}

// Parse IPN form data into typed object
export function parseIPN(formData: URLSearchParams): PayProIPN {
  // Parse custom fields: "x-userId=abc,x-planId=pro" (PayPro uses comma separator)
  const customFields = formData.get("ORDER_CUSTOM_FIELDS") || "";
  const customMap = new Map<string, string>();
  customFields.split(/[,;]/).forEach((pair) => {
    const [key, value] = pair.split("=");
    if (key && value) {
      customMap.set(key.replace("x-", ""), value);
    }
  });

  return {
    ipnTypeId: formData.get("IPN_TYPE_ID") || "",
    ipnTypeName: formData.get("IPN_TYPE_NAME") || "",
    testMode: formData.get("TEST_MODE") === "1",
    orderId: formData.get("ORDER_ID") || "",
    orderStatus: formData.get("ORDER_STATUS") || "",
    orderTotalAmount: formData.get("ORDER_TOTAL_AMOUNT") || "",
    orderCurrency: formData.get("ORDER_CURRENCY_CODE") || "",
    customerId: formData.get("CUSTOMER_ID") || "",
    customerEmail: formData.get("CUSTOMER_EMAIL") || "",
    customerFirstName: formData.get("CUSTOMER_FIRST_NAME") || "",
    customerLastName: formData.get("CUSTOMER_LAST_NAME") || "",
    productId: formData.get("PRODUCT_ID") || "",
    subscriptionId: formData.get("SUBSCRIPTION_ID") || "",
    subscriptionStatus: formData.get("SUBSCRIPTION_STATUS_NAME") || "",
    subscriptionNextChargeDate: formData.get("SUBSCRIPTION_NEXT_CHARGE_DATE") || "",
    subscriptionNextChargeAmount: formData.get("SUBSCRIPTION_NEXT_CHARGE_AMOUNT") || "",
    hash: formData.get("HASH") || "",
    signature: formData.get("SIGNATURE") || "",
    userId: customMap.get("userId") || "",
    planId: customMap.get("planId") || "",
    billingPeriod: customMap.get("billingPeriod") || "",
    packId: customMap.get("packId") || "",
  };
}

// Verify IPN HASH (MD5)
export function verifyHash(ipn: PayProIPN): boolean {
  if (ipn.testMode) {
    // Test mode hash is always MD5("1")
    return ipn.hash === "c4ca4238a0b923820dcc509a6f75849b";
  }

  const expected = createHash("md5")
    .update(ipn.orderId + PAYPRO_IPN_SECRET_KEY)
    .digest("hex");

  return ipn.hash === expected;
}

// Verify IPN SIGNATURE (SHA256)
export function verifySignature(ipn: PayProIPN): boolean {
  const data =
    ipn.orderId +
    ipn.orderStatus +
    ipn.orderTotalAmount +
    ipn.customerEmail +
    PAYPRO_VALIDATION_KEY +
    (ipn.testMode ? "1" : "0") +
    ipn.ipnTypeName;

  const expected = createHash("sha256").update(data).digest("hex");
  return ipn.signature === expected;
}

// Verify IP is from PayPro
export function verifyIP(ip: string): boolean {
  // In test mode, allow any IP
  if (PAYPRO_TEST_MODE) return true;

  // Strip IPv6 prefix
  const cleanIp = ip.replace("::ffff:", "");
  return PAYPRO_IPS.includes(cleanIp);
}

// PayPro API: Cancel subscription
export async function cancelSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${PAYPRO_API_BASE_URL}/Subscriptions/Suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionId: parseInt(subscriptionId),
        vendorAccountId: parseInt(PAYPRO_VENDOR_ACCOUNT_ID),
        apiSecretKey: PAYPRO_API_SECRET_KEY,
      }),
    });

    const data = await res.json();
    return { success: data.isSuccess === true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// PayPro API: Resume subscription
export async function resumeSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${PAYPRO_API_BASE_URL}/Subscriptions/Renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionId: parseInt(subscriptionId),
        vendorAccountId: parseInt(PAYPRO_VENDOR_ACCOUNT_ID),
        apiSecretKey: PAYPRO_API_SECRET_KEY,
      }),
    });

    const data = await res.json();
    return { success: data.isSuccess === true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// PayPro API: Terminate subscription permanently
export async function terminateSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${PAYPRO_API_BASE_URL}/Subscriptions/Terminate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionId: parseInt(subscriptionId),
        vendorAccountId: parseInt(PAYPRO_VENDOR_ACCOUNT_ID),
        apiSecretKey: PAYPRO_API_SECRET_KEY,
      }),
    });

    const data = await res.json();
    return { success: data.isSuccess === true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
