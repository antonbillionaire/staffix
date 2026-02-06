import {
  lemonSqueezySetup,
  createCheckout,
  getSubscription,
  cancelSubscription,
  updateSubscription,
  type Checkout,
} from "@lemonsqueezy/lemonsqueezy.js";

// Initialize Lemon Squeezy
export function initLemonSqueezy() {
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY!,
    onError: (error) => {
      console.error("Lemon Squeezy error:", error);
    },
  });
}

// Plan variant IDs from Lemon Squeezy dashboard
// You'll need to create products in Lemon Squeezy and add the variant IDs here
export const PLAN_VARIANTS = {
  // Monthly plans
  starter_monthly: process.env.LEMONSQUEEZY_STARTER_MONTHLY_VARIANT_ID || "",
  pro_monthly: process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID || "",
  business_monthly: process.env.LEMONSQUEEZY_BUSINESS_MONTHLY_VARIANT_ID || "",
  enterprise_monthly: process.env.LEMONSQUEEZY_ENTERPRISE_MONTHLY_VARIANT_ID || "",

  // Yearly plans
  starter_yearly: process.env.LEMONSQUEEZY_STARTER_YEARLY_VARIANT_ID || "",
  pro_yearly: process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID || "",
  business_yearly: process.env.LEMONSQUEEZY_BUSINESS_YEARLY_VARIANT_ID || "",
  enterprise_yearly: process.env.LEMONSQUEEZY_ENTERPRISE_YEARLY_VARIANT_ID || "",

  // Message packs (one-time purchases)
  pack_100: process.env.LEMONSQUEEZY_PACK_100_VARIANT_ID || "",
  pack_500: process.env.LEMONSQUEEZY_PACK_500_VARIANT_ID || "",
  pack_1000: process.env.LEMONSQUEEZY_PACK_1000_VARIANT_ID || "",
};

// Get variant ID for a plan
export function getVariantId(planId: string, billingPeriod: "monthly" | "yearly"): string {
  const key = `${planId}_${billingPeriod}` as keyof typeof PLAN_VARIANTS;
  return PLAN_VARIANTS[key] || "";
}

// Create a checkout session
export async function createCheckoutSession({
  variantId,
  userEmail,
  userId,
  businessId,
  redirectUrl,
}: {
  variantId: string;
  userEmail: string;
  userId: string;
  businessId: string;
  redirectUrl: string;
}): Promise<{ checkoutUrl: string } | { error: string }> {
  initLemonSqueezy();

  try {
    const storeId = process.env.LEMONSQUEEZY_STORE_ID!;

    const checkout = await createCheckout(storeId, variantId, {
      checkoutData: {
        email: userEmail,
        custom: {
          user_id: userId,
          business_id: businessId,
        },
      },
      checkoutOptions: {
        embed: false,
        media: true,
        logo: true,
      },
      productOptions: {
        redirectUrl,
        receiptButtonText: "Перейти в личный кабинет",
        receiptLinkUrl: redirectUrl,
        receiptThankYouNote: "Спасибо за покупку! Ваша подписка активирована.",
      },
    });

    if (checkout.error) {
      console.error("Checkout error:", checkout.error);
      return { error: "Ошибка создания оплаты" };
    }

    const checkoutUrl = checkout.data?.data.attributes.url;
    if (!checkoutUrl) {
      return { error: "Не удалось получить ссылку на оплату" };
    }

    return { checkoutUrl };
  } catch (error) {
    console.error("Create checkout error:", error);
    return { error: "Ошибка создания оплаты" };
  }
}

// Get subscription details
export async function getSubscriptionDetails(subscriptionId: string) {
  initLemonSqueezy();

  try {
    const subscription = await getSubscription(subscriptionId);
    return subscription.data?.data;
  } catch (error) {
    console.error("Get subscription error:", error);
    return null;
  }
}

// Cancel subscription
export async function cancelUserSubscription(subscriptionId: string) {
  initLemonSqueezy();

  try {
    const result = await cancelSubscription(subscriptionId);
    return { success: !result.error };
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return { success: false };
  }
}

// Resume subscription (if cancelled but not expired)
export async function resumeUserSubscription(subscriptionId: string) {
  initLemonSqueezy();

  try {
    const result = await updateSubscription(subscriptionId, {
      cancelled: false,
    });
    return { success: !result.error };
  } catch (error) {
    console.error("Resume subscription error:", error);
    return { success: false };
  }
}

// Map Lemon Squeezy variant to our plan ID
export function variantToPlanId(variantId: string): string {
  for (const [key, value] of Object.entries(PLAN_VARIANTS)) {
    if (value === variantId) {
      // Extract plan name (e.g., "starter_monthly" -> "starter")
      return key.split("_")[0];
    }
  }
  return "trial";
}

// Get messages limit for a plan
export function getPlanMessagesLimit(planId: string): number {
  const limits: Record<string, number> = {
    trial: 200,
    starter: 200,
    pro: 1000,
    business: 3000,
    enterprise: 999999,
  };
  return limits[planId] || 200;
}
