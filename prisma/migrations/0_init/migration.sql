-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verificationExpires" TIMESTAMP(3),
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "referredByCode" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "notifyNewBookings" BOOLEAN NOT NULL DEFAULT true,
    "notifyCancellations" BOOLEAN NOT NULL DEFAULT true,
    "notifyLowMessages" BOOLEAN NOT NULL DEFAULT true,
    "notifyTrialEnding" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "onboardingEmailsSent" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "workingHours" TEXT,
    "welcomeMessage" TEXT,
    "businessType" TEXT,
    "businessTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dashboardMode" TEXT NOT NULL DEFAULT 'service',
    "staffCount" INTEGER,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "industryCategory" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'UZ',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tashkent',
    "averageCheck" INTEGER,
    "targetAudience" JSONB,
    "aiInsights" JSONB,
    "totalConversations" INTEGER NOT NULL DEFAULT 0,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION,
    "crmSystem" TEXT,
    "aiTone" TEXT,
    "aiRules" TEXT,
    "systemPrompt" TEXT,
    "botDisplayName" TEXT,
    "botToken" TEXT,
    "botUsername" TEXT,
    "botActive" BOOLEAN NOT NULL DEFAULT false,
    "botLogo" TEXT,
    "webhookSecret" TEXT,
    "ownerTelegramUsername" TEXT,
    "ownerTelegramChatId" BIGINT,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deliveryTimeFrom" INTEGER,
    "deliveryTimeTo" INTEGER,
    "deliveryFee" INTEGER,
    "deliveryFreeFrom" INTEGER,
    "deliveryZones" TEXT,
    "paymeId" TEXT,
    "clickServiceId" TEXT,
    "clickMerchantId" TEXT,
    "kaspiPayLink" TEXT,
    "waPhoneNumberId" TEXT,
    "waAccessToken" TEXT,
    "waVerifyToken" TEXT,
    "waActive" BOOLEAN NOT NULL DEFAULT false,
    "fbPageId" TEXT,
    "fbPageAccessToken" TEXT,
    "fbVerifyToken" TEXT,
    "fbActive" BOOLEAN NOT NULL DEFAULT false,
    "igBusinessAccountId" TEXT,
    "igUsername" TEXT,
    "igActive" BOOLEAN NOT NULL DEFAULT false,
    "metaUserId" TEXT,
    "metaUserAccessToken" TEXT,
    "metaTokenExpiresAt" TIMESTAMP(3),
    "hidePoweredBy" BOOLEAN NOT NULL DEFAULT false,
    "tokensUsedInput" INTEGER NOT NULL DEFAULT 0,
    "tokensUsedOutput" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "timeFrom" INTEGER,
    "timeTo" INTEGER,
    "freeFrom" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "photo" TEXT,
    "telegramUsername" TEXT,
    "telegramChatId" BIGINT,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAQ" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "FAQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientTelegramId" BIGINT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reminder24hSent" BOOLEAN NOT NULL DEFAULT false,
    "reminder2hSent" BOOLEAN NOT NULL DEFAULT false,
    "reviewRequested" BOOLEAN NOT NULL DEFAULT false,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "clientTelegramId" BIGINT NOT NULL,
    "clientName" TEXT,
    "businessId" TEXT NOT NULL,
    "summary" TEXT,
    "topic" TEXT,
    "outcome" TEXT,
    "extractedInfo" JSONB,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "needsSummary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "messagesUsed" INTEGER NOT NULL DEFAULT 0,
    "messagesLimit" INTEGER NOT NULL DEFAULT 100,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "payproOrderId" TEXT,
    "payproSubscriptionId" TEXT,
    "payproCustomerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "billingPeriod" TEXT,
    "reminder7dSent" BOOLEAN NOT NULL DEFAULT false,
    "reminder3dSent" BOOLEAN NOT NULL DEFAULT false,
    "reminder1dSent" BOOLEAN NOT NULL DEFAULT false,
    "limitWarning80Sent" BOOLEAN NOT NULL DEFAULT false,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "extractedText" TEXT,
    "parsed" BOOLEAN NOT NULL DEFAULT false,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "rating" INTEGER,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isFromSupport" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "ticketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationSettings" (
    "id" TEXT NOT NULL,
    "reminder24hEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder2hEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reviewEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reviewDelayHours" INTEGER NOT NULL DEFAULT 2,
    "reviewGoogleLink" TEXT,
    "review2gisLink" TEXT,
    "reviewYandexLink" TEXT,
    "reactivationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reactivationDays" INTEGER NOT NULL DEFAULT 30,
    "reactivationDiscount" INTEGER NOT NULL DEFAULT 10,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledReminder" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "clientTelegramId" BIGINT NOT NULL,
    "clientName" TEXT,
    "serviceName" TEXT,
    "appointmentDate" TIMESTAMP(3),
    "lastVisitDate" TIMESTAMP(3),
    "discountCode" TEXT,
    "bookingId" TEXT,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "clientTelegramId" BIGINT NOT NULL,
    "clientName" TEXT,
    "bookingId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "responded" BOOLEAN NOT NULL DEFAULT false,
    "responseText" TEXT,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "name" TEXT,
    "surname" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "loyaltyProgramIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastVisitDate" TIMESTAMP(3),
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastReactivationSent" TIMESTAMP(3),
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "loyaltyVisits" INTEGER NOT NULL DEFAULT 0,
    "loyaltyTotalSpent" INTEGER NOT NULL DEFAULT 0,
    "aiSummary" TEXT,
    "preferences" JSONB,
    "importantNotes" TEXT,
    "communicationStyle" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "summaryUpdatedAt" TIMESTAMP(3),
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAutomation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL,
    "triggerParams" JSONB NOT NULL DEFAULT '{}',
    "action" TEXT NOT NULL,
    "actionParams" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "targetPlan" TEXT,
    "targetStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastDelivery" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "telegramBotId" TEXT,
    "telegramBotUsername" TEXT,
    "whatsappPhoneId" TEXT,
    "whatsappPhoneNumber" TEXT,
    "whatsappBusinessAccId" TEXT,
    "instagramAccountId" TEXT,
    "instagramUsername" TEXT,
    "instagramPageId" TEXT,
    "metaAccessToken" TEXT,
    "metaTokenExpiresAt" TIMESTAMP(3),
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "webhookVerified" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "errorAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelClient" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "telegramId" TEXT,
    "telegramUsername" TEXT,
    "telegramChatId" TEXT,
    "whatsappPhone" TEXT,
    "whatsappId" TEXT,
    "instagramId" TEXT,
    "instagramUsername" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "profilePicUrl" TEXT,
    "language" TEXT,
    "timezone" TEXT,
    "firstContactAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastContactAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChannel" TEXT,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "customFields" JSONB,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMessage" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "channelMessageId" TEXT,
    "chatId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "text" TEXT,
    "attachments" JSONB,
    "aiProcessed" BOOLEAN NOT NULL DEFAULT false,
    "aiResponse" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "metadata" JSONB,
    "clientId" TEXT,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "adId" TEXT,
    "channel" TEXT NOT NULL,
    "clientName" TEXT,
    "firstMessage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'cold',
    "score" INTEGER NOT NULL DEFAULT 0,
    "qualifiedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "lastInteractionAt" TIMESTAMP(3),
    "statusReason" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "clientId" TEXT,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBroadcast" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetSegment" TEXT NOT NULL DEFAULT 'all',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientsCount" INTEGER NOT NULL DEFAULT 0,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBroadcastDelivery" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientBroadcastDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesLead" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT,
    "telegramUsername" TEXT,
    "telegramChatId" BIGINT,
    "instagramId" TEXT,
    "fbPsid" TEXT,
    "whatsappPhone" TEXT,
    "name" TEXT,
    "businessName" TEXT,
    "businessType" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'telegram',
    "stage" TEXT NOT NULL DEFAULT 'new',
    "painPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedPlan" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "history" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConversation" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachLead" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "category" TEXT,
    "city" TEXT,
    "website" TEXT,
    "email" TEXT,
    "telegram" TEXT,
    "instagram" TEXT,
    "whatsapp" TEXT,
    "outreachChannel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSchedule" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isWorkday" BOOLEAN NOT NULL DEFAULT true,
    "staffId" TEXT NOT NULL,

    CONSTRAINT "StaffSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTimeOff" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'vacation',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "oldPrice" INTEGER,
    "stock" INTEGER,
    "sku" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientAddress" TEXT,
    "clientTelegramId" BIGINT,
    "clientNotes" TEXT,
    "totalPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "paymentMethod" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "notifiedOwner" BOOLEAN NOT NULL DEFAULT false,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "website" TEXT,
    "description" TEXT,
    "referralCode" TEXT,
    "accessToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedAt" TIMESTAMP(3),
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingPayout" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerReferral" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "signedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "convertedAt" TIMESTAMP(3),
    "convertedPlan" TEXT,
    "partnerId" TEXT NOT NULL,

    CONSTRAINT "PartnerReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerEarning" (
    "id" TEXT NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "paymentAmount" DOUBLE PRECISION NOT NULL,
    "subscriptionPlan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "referralId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'cashback',
    "name" TEXT,
    "cashbackPercent" INTEGER DEFAULT 5,
    "visitsForReward" INTEGER DEFAULT 10,
    "rewardType" TEXT DEFAULT 'discount',
    "rewardDiscount" INTEGER DEFAULT 50,
    "tiers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_entries" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_entries_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CrmIntegration" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_dedup" (
    "id" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_dedup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "Business_botToken_key" ON "Business"("botToken");

-- CreateIndex
CREATE INDEX "Business_fbPageId_idx" ON "Business"("fbPageId");

-- CreateIndex
CREATE INDEX "Business_igBusinessAccountId_idx" ON "Business"("igBusinessAccountId");

-- CreateIndex
CREATE INDEX "Business_waPhoneNumberId_idx" ON "Business"("waPhoneNumberId");

-- CreateIndex
CREATE INDEX "DeliveryZone_businessId_isActive_idx" ON "DeliveryZone"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "Service_businessId_idx" ON "Service"("businessId");

-- CreateIndex
CREATE INDEX "Staff_businessId_idx" ON "Staff"("businessId");

-- CreateIndex
CREATE INDEX "FAQ_businessId_idx" ON "FAQ"("businessId");

-- CreateIndex
CREATE INDEX "Booking_businessId_idx" ON "Booking"("businessId");

-- CreateIndex
CREATE INDEX "Booking_businessId_date_idx" ON "Booking"("businessId", "date");

-- CreateIndex
CREATE INDEX "Conversation_businessId_updatedAt_idx" ON "Conversation"("businessId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_needsSummary_idx" ON "Conversation"("needsSummary");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_businessId_clientTelegramId_key" ON "Conversation"("businessId", "clientTelegramId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_businessId_key" ON "Subscription"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationSettings_businessId_key" ON "AutomationSettings"("businessId");

-- CreateIndex
CREATE INDEX "ScheduledReminder_status_scheduledFor_idx" ON "ScheduledReminder"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ScheduledReminder_businessId_type_idx" ON "ScheduledReminder"("businessId", "type");

-- CreateIndex
CREATE INDEX "Review_businessId_rating_idx" ON "Review"("businessId", "rating");

-- CreateIndex
CREATE INDEX "Client_businessId_lastVisitDate_idx" ON "Client"("businessId", "lastVisitDate");

-- CreateIndex
CREATE INDEX "Client_businessId_lastMessageAt_idx" ON "Client"("businessId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_businessId_telegramId_key" ON "Client"("businessId", "telegramId");

-- CreateIndex
CREATE INDEX "AutomationExecution_automationId_createdAt_idx" ON "AutomationExecution"("automationId", "createdAt");

-- CreateIndex
CREATE INDEX "BroadcastDelivery_broadcastId_status_idx" ON "BroadcastDelivery"("broadcastId", "status");

-- CreateIndex
CREATE INDEX "BroadcastDelivery_userId_idx" ON "BroadcastDelivery"("userId");

-- CreateIndex
CREATE INDEX "UserTag_tag_idx" ON "UserTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "UserTag_userId_tag_key" ON "UserTag"("userId", "tag");

-- CreateIndex
CREATE INDEX "ChannelConnection_channel_isConnected_idx" ON "ChannelConnection"("channel", "isConnected");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_businessId_channel_key" ON "ChannelConnection"("businessId", "channel");

-- CreateIndex
CREATE INDEX "ChannelClient_businessId_telegramId_idx" ON "ChannelClient"("businessId", "telegramId");

-- CreateIndex
CREATE INDEX "ChannelClient_businessId_whatsappPhone_idx" ON "ChannelClient"("businessId", "whatsappPhone");

-- CreateIndex
CREATE INDEX "ChannelClient_businessId_instagramId_idx" ON "ChannelClient"("businessId", "instagramId");

-- CreateIndex
CREATE INDEX "ChannelClient_businessId_lastContactAt_idx" ON "ChannelClient"("businessId", "lastContactAt");

-- CreateIndex
CREATE INDEX "ChannelMessage_businessId_channel_idx" ON "ChannelMessage"("businessId", "channel");

-- CreateIndex
CREATE INDEX "ChannelMessage_businessId_clientId_idx" ON "ChannelMessage"("businessId", "clientId");

-- CreateIndex
CREATE INDEX "ChannelMessage_chatId_channel_idx" ON "ChannelMessage"("chatId", "channel");

-- CreateIndex
CREATE INDEX "Lead_businessId_source_idx" ON "Lead"("businessId", "source");

-- CreateIndex
CREATE INDEX "Lead_businessId_status_idx" ON "Lead"("businessId", "status");

-- CreateIndex
CREATE INDEX "Lead_businessId_createdAt_idx" ON "Lead"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_businessId_channel_clientId_key" ON "Lead"("businessId", "channel", "clientId");

-- CreateIndex
CREATE INDEX "ClientBroadcast_businessId_status_idx" ON "ClientBroadcast"("businessId", "status");

-- CreateIndex
CREATE INDEX "ClientBroadcastDelivery_broadcastId_status_idx" ON "ClientBroadcastDelivery"("broadcastId", "status");

-- CreateIndex
CREATE INDEX "ClientBroadcastDelivery_clientId_idx" ON "ClientBroadcastDelivery"("clientId");

-- CreateIndex
CREATE INDEX "Notification_businessId_isRead_idx" ON "Notification"("businessId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_businessId_createdAt_idx" ON "Notification"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLead_telegramChatId_key" ON "SalesLead"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLead_instagramId_key" ON "SalesLead"("instagramId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLead_fbPsid_key" ON "SalesLead"("fbPsid");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLead_whatsappPhone_key" ON "SalesLead"("whatsappPhone");

-- CreateIndex
CREATE INDEX "SalesLead_stage_idx" ON "SalesLead"("stage");

-- CreateIndex
CREATE INDEX "SalesLead_channel_idx" ON "SalesLead"("channel");

-- CreateIndex
CREATE INDEX "SalesLead_createdAt_idx" ON "SalesLead"("createdAt");

-- CreateIndex
CREATE INDEX "ChannelConversation_businessId_channel_idx" ON "ChannelConversation"("businessId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConversation_businessId_channel_clientId_key" ON "ChannelConversation"("businessId", "channel", "clientId");

-- CreateIndex
CREATE INDEX "OutreachLead_campaignId_status_idx" ON "OutreachLead"("campaignId", "status");

-- CreateIndex
CREATE INDEX "OutreachLead_campaignId_outreachChannel_idx" ON "OutreachLead"("campaignId", "outreachChannel");

-- CreateIndex
CREATE INDEX "StaffSchedule_staffId_idx" ON "StaffSchedule"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffSchedule_staffId_dayOfWeek_key" ON "StaffSchedule"("staffId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "StaffTimeOff_staffId_startDate_idx" ON "StaffTimeOff"("staffId", "startDate");

-- CreateIndex
CREATE INDEX "StaffTimeOff_staffId_endDate_idx" ON "StaffTimeOff"("staffId", "endDate");

-- CreateIndex
CREATE INDEX "Product_businessId_isActive_idx" ON "Product"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "Product_businessId_category_idx" ON "Product"("businessId", "category");

-- CreateIndex
CREATE INDEX "Order_businessId_status_idx" ON "Order"("businessId", "status");

-- CreateIndex
CREATE INDEX "Order_businessId_createdAt_idx" ON "Order"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_businessId_clientTelegramId_idx" ON "Order"("businessId", "clientTelegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_orderNumber_key" ON "Order"("businessId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_referralCode_key" ON "Partner"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_accessToken_key" ON "Partner"("accessToken");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE INDEX "Partner_referralCode_idx" ON "Partner"("referralCode");

-- CreateIndex
CREATE INDEX "PartnerReferral_partnerId_converted_idx" ON "PartnerReferral"("partnerId", "converted");

-- CreateIndex
CREATE INDEX "PartnerReferral_referralCode_idx" ON "PartnerReferral"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerReferral_userId_key" ON "PartnerReferral"("userId");

-- CreateIndex
CREATE INDEX "PartnerEarning_partnerId_status_idx" ON "PartnerEarning"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerEarning_partnerId_createdAt_idx" ON "PartnerEarning"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyProgram_businessId_idx" ON "LoyaltyProgram"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyProgram_businessId_type_key" ON "LoyaltyProgram"("businessId", "type");

-- CreateIndex
CREATE INDEX "CrmIntegration_businessId_isActive_idx" ON "CrmIntegration"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "CrmIntegration_businessId_type_idx" ON "CrmIntegration"("businessId", "type");

-- CreateIndex
CREATE INDEX "webhook_dedup_processedAt_idx" ON "webhook_dedup"("processedAt");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAQ" ADD CONSTRAINT "FAQ_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSettings" ADD CONSTRAINT "AutomationSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReminder" ADD CONSTRAINT "ScheduledReminder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReminder" ADD CONSTRAINT "ScheduledReminder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "AdminAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastDelivery" ADD CONSTRAINT "BroadcastDelivery_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelClient" ADD CONSTRAINT "ChannelClient_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ChannelClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ChannelClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBroadcast" ADD CONSTRAINT "ClientBroadcast_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBroadcastDelivery" ADD CONSTRAINT "ClientBroadcastDelivery_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "ClientBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelConversation" ADD CONSTRAINT "ChannelConversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachLead" ADD CONSTRAINT "OutreachLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerEarning" ADD CONSTRAINT "PartnerEarning_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "PartnerReferral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerEarning" ADD CONSTRAINT "PartnerEarning_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmIntegration" ADD CONSTRAINT "CrmIntegration_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

