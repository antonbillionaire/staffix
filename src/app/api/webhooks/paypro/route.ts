import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlan, type PlanId } from "@/lib/plans";
import {
  parseIPN,
  verifyHash,
  verifySignature,
  verifyIP,
  IPN_TYPES,
} from "@/lib/paypro";

export async function POST(request: NextRequest) {
  try {
    // Verify IP
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

    if (!verifyIP(ip)) {
      console.error(`PayPro webhook: rejected IP ${ip}`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse form data (PayPro sends application/x-www-form-urlencoded)
    const body = await request.text();
    const formData = new URLSearchParams(body);
    const ipn = parseIPN(formData);

    console.log(`PayPro IPN: type=${ipn.ipnTypeName} order=${ipn.orderId} sub=${ipn.subscriptionId} user=${ipn.userId} plan=${ipn.planId}`);

    // Verify HASH
    if (!verifyHash(ipn)) {
      console.error("PayPro webhook: invalid HASH");
      return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
    }

    // Verify SIGNATURE
    if (!verifySignature(ipn)) {
      console.error("PayPro webhook: invalid SIGNATURE");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Find user's business by userId from custom params
    if (!ipn.userId) {
      console.error("PayPro webhook: missing userId in custom fields");
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: ipn.userId },
      include: { subscription: true },
    });

    if (!business) {
      console.error(`PayPro webhook: business not found for user ${ipn.userId}`);
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Handle IPN events
    switch (ipn.ipnTypeId) {
      // Initial payment successful
      case IPN_TYPES.ORDER_CHARGED: {
        const planId = (ipn.planId || "pro") as PlanId;
        const billingPeriod = ipn.billingPeriod || "monthly";
        const planConfig = getPlan(planId);

        // Calculate expiration date
        const expiresAt = new Date();
        if (billingPeriod === "yearly") {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

        // Activate subscription
        await prisma.subscription.upsert({
          where: { businessId: business.id },
          update: {
            plan: planId,
            messagesLimit: planConfig.features.messagesLimit,
            messagesUsed: 0,
            expiresAt,
            status: "active",
            billingPeriod,
            payproOrderId: ipn.orderId,
            payproSubscriptionId: ipn.subscriptionId || null,
            payproCustomerId: ipn.customerId || null,
          },
          create: {
            businessId: business.id,
            plan: planId,
            messagesLimit: planConfig.features.messagesLimit,
            messagesUsed: 0,
            expiresAt,
            status: "active",
            billingPeriod,
            payproOrderId: ipn.orderId,
            payproSubscriptionId: ipn.subscriptionId || null,
            payproCustomerId: ipn.customerId || null,
          },
        });

        console.log(`PayPro: Activated ${planId} plan for business ${business.id}`);
        break;
      }

      // Recurring payment successful
      case IPN_TYPES.SUBSCRIPTION_CHARGE_SUCCEED: {
        if (!business.subscription) break;

        const planConfig = getPlan(business.subscription.plan as PlanId);

        // Extend subscription and reset message counter
        const expiresAt = new Date();
        if (business.subscription.billingPeriod === "yearly") {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

        await prisma.subscription.update({
          where: { id: business.subscription.id },
          data: {
            messagesUsed: 0,
            messagesLimit: planConfig.features.messagesLimit,
            expiresAt,
            status: "active",
          },
        });

        console.log(`PayPro: Renewed subscription for business ${business.id}`);
        break;
      }

      // Recurring payment failed
      case IPN_TYPES.SUBSCRIPTION_CHARGE_FAILED: {
        if (!business.subscription) break;

        await prisma.subscription.update({
          where: { id: business.subscription.id },
          data: { status: "active" }, // Still active, PayPro will retry
        });

        console.log(`PayPro: Payment failed for business ${business.id}, PayPro will retry`);
        break;
      }

      // Subscription suspended (after all retries failed)
      case IPN_TYPES.SUBSCRIPTION_SUSPENDED: {
        if (!business.subscription) break;

        await prisma.subscription.update({
          where: { id: business.subscription.id },
          data: { status: "suspended" },
        });

        console.log(`PayPro: Subscription suspended for business ${business.id}`);
        break;
      }

      // Subscription terminated or finished
      case IPN_TYPES.SUBSCRIPTION_TERMINATED:
      case IPN_TYPES.SUBSCRIPTION_FINISHED: {
        if (!business.subscription) break;

        // Downgrade to trial-like state
        await prisma.subscription.update({
          where: { id: business.subscription.id },
          data: {
            status: "expired",
            payproSubscriptionId: null,
          },
        });

        console.log(`PayPro: Subscription ended for business ${business.id}`);
        break;
      }

      // Subscription renewed (reactivated after suspension)
      case IPN_TYPES.SUBSCRIPTION_RENEWED: {
        if (!business.subscription) break;

        await prisma.subscription.update({
          where: { id: business.subscription.id },
          data: { status: "active" },
        });

        console.log(`PayPro: Subscription renewed for business ${business.id}`);
        break;
      }

      // Refund
      case IPN_TYPES.ORDER_REFUNDED: {
        if (!business.subscription) break;

        await prisma.subscription.update({
          where: { id: business.subscription.id },
          data: {
            status: "expired",
            plan: "trial",
            messagesLimit: 200,
            payproSubscriptionId: null,
          },
        });

        console.log(`PayPro: Refund processed for business ${business.id}`);
        break;
      }

      default:
        console.log(`PayPro: Unhandled IPN type ${ipn.ipnTypeId} (${ipn.ipnTypeName})`);
    }

    // PayPro requires HTTP 200 for successful processing
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("PayPro webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 }
    );
  }
}
