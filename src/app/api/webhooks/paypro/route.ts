import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlan, MESSAGE_PACKS, type PlanId } from "@/lib/plans";
import {
  parseIPN,
  verifyHash,
  verifySignature,
  verifyIP,
  IPN_TYPES,
} from "@/lib/paypro";
import { notifyNewPayment } from "@/lib/admin-notify";

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
        // Check if this is a message pack purchase
        if (ipn.packId) {
          const pack = MESSAGE_PACKS.find((p) => p.id === ipn.packId);
          if (pack && business.subscription) {
            await prisma.subscription.update({
              where: { id: business.subscription.id },
              data: {
                messagesLimit: {
                  increment: pack.messages,
                },
              },
            });
            console.log(`PayPro: Added ${pack.messages} messages (${ipn.packId}) for business ${business.id}`);

            const user = await prisma.user.findUnique({ where: { id: ipn.userId! } });
            if (user) {
              notifyNewPayment(user.name, user.email, pack.name, pack.price).catch(() => {});
            }
          }
          break;
        }

        // Subscription purchase
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

        // Notify admin about payment
        const user = await prisma.user.findUnique({ where: { id: ipn.userId! } });
        if (user) {
          const price = billingPeriod === "yearly" ? planConfig.yearlyPrice : planConfig.monthlyPrice;
          notifyNewPayment(user.name, user.email, planConfig.name, price).catch(() => {});
        }
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

      // Chargeback — same as refund, deactivate subscription
      case IPN_TYPES.ORDER_CHARGED_BACK: {
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

        console.log(`PayPro: Chargeback for business ${business.id}`);
        break;
      }

      // Partial refund — keep subscription active, just log
      case IPN_TYPES.ORDER_PARTIALLY_REFUNDED: {
        console.log(`PayPro: Partial refund for business ${business.id}, order ${ipn.orderId}`);
        break;
      }

      // Trial charge — trial converted to paid, same as ORDER_CHARGED
      case IPN_TYPES.TRIAL_CHARGE: {
        const planId = (ipn.planId || "pro") as PlanId;
        const billingPeriod = ipn.billingPeriod || "monthly";
        const planConfig = getPlan(planId);

        const expiresAt = new Date();
        if (billingPeriod === "yearly") {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

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

        console.log(`PayPro: Trial charge → activated ${planId} for business ${business.id}`);

        const trialUser = await prisma.user.findUnique({ where: { id: ipn.userId! } });
        if (trialUser) {
          const price = billingPeriod === "yearly" ? planConfig.yearlyPrice : planConfig.monthlyPrice;
          notifyNewPayment(trialUser.name, trialUser.email, planConfig.name, price).catch(() => {});
        }
        break;
      }

      // Informational events — just log
      case IPN_TYPES.ORDER_CHARGEBACK_WON:
      case IPN_TYPES.ORDER_CUSTOMER_INFO_CHANGED:
      case IPN_TYPES.ORDER_ON_WAITING:
      case IPN_TYPES.SUBSCRIPTION_PAYMENT_INFO_CHANGED:
      case IPN_TYPES.LICENSE_REQUEST: {
        console.log(`PayPro: Info event ${ipn.ipnTypeName} for business ${business.id}`);
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
