import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { variantToPlanId, getPlanMessagesLimit } from "@/lib/lemonsqueezy";

// Verify webhook signature
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

interface WebhookPayload {
  meta: {
    event_name: string;
    custom_data?: {
      user_id?: string;
      business_id?: string;
    };
  };
  data: {
    id: string;
    type: string;
    attributes: {
      status: string;
      status_formatted: string;
      user_email: string;
      user_name: string;
      variant_id: number;
      product_id: number;
      order_id: number;
      subscription_id?: number;
      customer_id: number;
      renews_at?: string;
      ends_at?: string;
      created_at: string;
      updated_at: string;
      cancelled?: boolean;
      // For orders
      total?: number;
      total_formatted?: string;
      first_order_item?: {
        variant_id: number;
      };
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("x-signature") || "";

    // Verify signature
    if (!verifySignature(payload, signature)) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data: WebhookPayload = JSON.parse(payload);
    const eventName = data.meta.event_name;

    console.log(`Lemon Squeezy webhook: ${eventName}`);

    switch (eventName) {
      case "subscription_created":
        await handleSubscriptionCreated(data);
        break;
      case "subscription_updated":
        await handleSubscriptionUpdated(data);
        break;
      case "subscription_cancelled":
        await handleSubscriptionCancelled(data);
        break;
      case "subscription_resumed":
        await handleSubscriptionResumed(data);
        break;
      case "subscription_expired":
        await handleSubscriptionExpired(data);
        break;
      case "subscription_payment_success":
        await handlePaymentSuccess(data);
        break;
      case "subscription_payment_failed":
        await handlePaymentFailed(data);
        break;
      case "order_created":
        await handleOrderCreated(data);
        break;
      default:
        console.log(`Unhandled event: ${eventName}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}

// Handle new subscription
async function handleSubscriptionCreated(payload: WebhookPayload) {
  const { attributes } = payload.data;
  const customData = payload.meta.custom_data;

  if (!customData?.business_id) {
    console.error("No business_id in custom data");
    return;
  }

  const variantId = attributes.variant_id.toString();
  const planId = variantToPlanId(variantId);
  const messagesLimit = getPlanMessagesLimit(planId);

  // Calculate expiration date
  const renewsAt = attributes.renews_at
    ? new Date(attributes.renews_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Update subscription in database
  await prisma.subscription.upsert({
    where: { businessId: customData.business_id },
    create: {
      businessId: customData.business_id,
      plan: planId,
      messagesLimit,
      messagesUsed: 0,
      expiresAt: renewsAt,
      lemonSqueezySubscriptionId: payload.data.id,
      lemonSqueezyCustomerId: attributes.customer_id.toString(),
      status: "active",
    },
    update: {
      plan: planId,
      messagesLimit,
      messagesUsed: 0, // Reset on new subscription
      expiresAt: renewsAt,
      lemonSqueezySubscriptionId: payload.data.id,
      lemonSqueezyCustomerId: attributes.customer_id.toString(),
      status: "active",
    },
  });

  console.log(`Subscription created for business ${customData.business_id}: ${planId}`);
}

// Handle subscription update (plan change)
async function handleSubscriptionUpdated(payload: WebhookPayload) {
  const { attributes } = payload.data;
  const subscriptionId = payload.data.id;

  const subscription = await prisma.subscription.findFirst({
    where: { lemonSqueezySubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.error("Subscription not found:", subscriptionId);
    return;
  }

  const variantId = attributes.variant_id.toString();
  const planId = variantToPlanId(variantId);
  const messagesLimit = getPlanMessagesLimit(planId);

  const renewsAt = attributes.renews_at
    ? new Date(attributes.renews_at)
    : subscription.expiresAt;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      plan: planId,
      messagesLimit,
      expiresAt: renewsAt,
      status: attributes.cancelled ? "cancelled" : "active",
    },
  });

  console.log(`Subscription updated: ${planId}`);
}

// Handle subscription cancellation
async function handleSubscriptionCancelled(payload: WebhookPayload) {
  const subscriptionId = payload.data.id;

  const subscription = await prisma.subscription.findFirst({
    where: { lemonSqueezySubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.error("Subscription not found:", subscriptionId);
    return;
  }

  // Don't change plan immediately - let them use until end of period
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "cancelled",
    },
  });

  console.log(`Subscription cancelled: ${subscriptionId}`);
}

// Handle subscription resumed
async function handleSubscriptionResumed(payload: WebhookPayload) {
  const subscriptionId = payload.data.id;

  const subscription = await prisma.subscription.findFirst({
    where: { lemonSqueezySubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.error("Subscription not found:", subscriptionId);
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "active",
    },
  });

  console.log(`Subscription resumed: ${subscriptionId}`);
}

// Handle subscription expired
async function handleSubscriptionExpired(payload: WebhookPayload) {
  const subscriptionId = payload.data.id;

  const subscription = await prisma.subscription.findFirst({
    where: { lemonSqueezySubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.error("Subscription not found:", subscriptionId);
    return;
  }

  // Downgrade to trial
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      plan: "trial",
      messagesLimit: 200,
      status: "expired",
    },
  });

  console.log(`Subscription expired: ${subscriptionId}`);
}

// Handle successful payment (renewal)
async function handlePaymentSuccess(payload: WebhookPayload) {
  const subscriptionId = payload.data.id;
  const { attributes } = payload.data;

  const subscription = await prisma.subscription.findFirst({
    where: { lemonSqueezySubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.error("Subscription not found:", subscriptionId);
    return;
  }

  const renewsAt = attributes.renews_at
    ? new Date(attributes.renews_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Reset messages and extend subscription
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      messagesUsed: 0,
      expiresAt: renewsAt,
      status: "active",
    },
  });

  console.log(`Payment successful, subscription renewed: ${subscriptionId}`);
}

// Handle failed payment
async function handlePaymentFailed(payload: WebhookPayload) {
  const subscriptionId = payload.data.id;

  const subscription = await prisma.subscription.findFirst({
    where: { lemonSqueezySubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.error("Subscription not found:", subscriptionId);
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "past_due",
    },
  });

  console.log(`Payment failed: ${subscriptionId}`);

  // TODO: Send email notification about failed payment
}

// Handle one-time order (message packs)
async function handleOrderCreated(payload: WebhookPayload) {
  const customData = payload.meta.custom_data;
  const { attributes } = payload.data;

  if (!customData?.business_id) {
    console.error("No business_id in custom data");
    return;
  }

  // Get variant ID from order
  const variantId = attributes.first_order_item?.variant_id?.toString() || "";

  // Check if this is a message pack
  const packMessages: Record<string, number> = {
    [process.env.LEMONSQUEEZY_PACK_100_VARIANT_ID || ""]: 100,
    [process.env.LEMONSQUEEZY_PACK_500_VARIANT_ID || ""]: 500,
    [process.env.LEMONSQUEEZY_PACK_1000_VARIANT_ID || ""]: 1000,
  };

  const additionalMessages = packMessages[variantId];

  if (additionalMessages) {
    // Add messages to subscription
    const subscription = await prisma.subscription.findUnique({
      where: { businessId: customData.business_id },
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          messagesLimit: {
            increment: additionalMessages,
          },
        },
      });

      console.log(`Added ${additionalMessages} messages to business ${customData.business_id}`);
    }
  }
}
