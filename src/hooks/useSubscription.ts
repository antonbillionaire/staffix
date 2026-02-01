"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type PlanId,
  type PlanFeatures,
  getPlan,
  getPlanFeatures,
  hasMenuAccess,
  canUseAutomations,
  canUploadLogo,
  canUploadFiles,
  canExportAnalytics,
  hasFullAnalytics,
} from "@/lib/plans";

export interface Subscription {
  id: string;
  plan: PlanId;
  messagesUsed: number;
  messagesLimit: number;
  expiresAt: string;
}

export interface UseSubscriptionResult {
  // Data
  subscription: Subscription | null;
  plan: PlanId;
  planName: string;
  features: PlanFeatures;

  // Status
  loading: boolean;
  error: string | null;

  // Limits
  messagesUsed: number;
  messagesLimit: number;
  messagesRemaining: number;
  messagesPercentUsed: number;
  daysLeft: number;
  isExpired: boolean;
  isTrialPlan: boolean;
  isTrialExpired: boolean; // Trial plan AND expired
  needsUpgrade: boolean;   // Show upgrade prompt (trial expired)

  // Feature checks
  canUseAutomations: boolean;
  canUploadLogo: boolean;
  canUploadFiles: boolean;
  canExportAnalytics: boolean;
  hasFullAnalytics: boolean;

  // Helpers
  hasAccess: (requiredPlan: PlanId) => boolean;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/subscription");
      if (!res.ok) {
        throw new Error("Failed to fetch subscription");
      }

      const data = await res.json();
      setSubscription(data.subscription);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Default to trial if fetch fails
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Determine current plan (default to trial if no subscription)
  const plan: PlanId = (subscription?.plan as PlanId) || "trial";
  const planConfig = getPlan(plan);
  const features = getPlanFeatures(plan);

  // Calculate limits
  const messagesUsed = subscription?.messagesUsed || 0;
  const messagesLimit = subscription?.messagesLimit || features.messagesLimit;
  const messagesRemaining = Math.max(0, messagesLimit - messagesUsed);
  const messagesPercentUsed = messagesLimit > 0
    ? Math.round((messagesUsed / messagesLimit) * 100)
    : 0;

  // Calculate days left
  const expiresAt = subscription?.expiresAt ? new Date(subscription.expiresAt) : null;
  const now = new Date();
  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 14; // Default 14 days for new trial
  const isExpired = expiresAt ? expiresAt < now : false;
  const isTrialPlan = plan === "trial";
  const isTrialExpired = isTrialPlan && isExpired;
  const needsUpgrade = isTrialExpired; // Trial ended, needs to pay

  // Helper to check if user has access to a required plan level
  const hasAccess = useCallback((requiredPlan: PlanId): boolean => {
    return hasMenuAccess(plan, requiredPlan);
  }, [plan]);

  return {
    // Data
    subscription,
    plan,
    planName: planConfig.name,
    features,

    // Status
    loading,
    error,

    // Limits
    messagesUsed,
    messagesLimit,
    messagesRemaining,
    messagesPercentUsed,
    daysLeft,
    isExpired,
    isTrialPlan,
    isTrialExpired,
    needsUpgrade,

    // Feature checks (blocked if trial expired)
    canUseAutomations: !needsUpgrade && canUseAutomations(plan),
    canUploadLogo: !needsUpgrade && canUploadLogo(plan),
    canUploadFiles: !needsUpgrade && canUploadFiles(plan),
    canExportAnalytics: !needsUpgrade && canExportAnalytics(plan),
    hasFullAnalytics: !needsUpgrade && hasFullAnalytics(plan),

    // Helpers
    hasAccess,
    refetch: fetchSubscription,
  };
}
