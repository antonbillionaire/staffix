# Lemon Squeezy Integration Setup

## Overview

Staffix uses Lemon Squeezy as a Merchant of Record (MoR) for payment processing. This means Lemon Squeezy handles:
- Payment processing (Visa, Mastercard, American Express)
- VAT/Tax collection and remittance
- Invoicing and receipts
- Subscription management
- Refunds

## Setup Steps

### 1. Create Lemon Squeezy Account

1. Go to [lemonsqueezy.com](https://lemonsqueezy.com) and create an account
2. Complete the onboarding process and verify your account

### 2. Create Products in Lemon Squeezy Dashboard

Create the following products and variants:

#### Subscription Plans (Monthly)
- **Starter Monthly** - $19/month - 200 messages
- **Pro Monthly** - $49/month - 1000 messages
- **Business Monthly** - $99/month - 3000 messages
- **Enterprise Monthly** - $249/month - Unlimited messages

#### Subscription Plans (Yearly)
- **Starter Yearly** - $182/year (~$15/month)
- **Pro Yearly** - $470/year (~$39/month)
- **Business Yearly** - $950/year (~$79/month)
- **Enterprise Yearly** - $2390/year (~$199/month)

#### Message Packs (One-time purchases)
- **100 Messages Pack** - $5
- **500 Messages Pack** - $20
- **1000 Messages Pack** - $35

### 3. Get API Keys

1. Go to **Settings > API** in Lemon Squeezy dashboard
2. Create a new API key
3. Copy the API key

### 4. Get Store ID

1. Go to **Settings > Stores** in Lemon Squeezy dashboard
2. Copy your Store ID (numeric value)

### 5. Get Variant IDs

For each product you created:
1. Go to the product page
2. Click on the variant
3. Copy the Variant ID from the URL or the variant details

### 6. Setup Webhook

1. Go to **Settings > Webhooks** in Lemon Squeezy dashboard
2. Create a new webhook with URL: `https://your-domain.com/api/webhooks/lemonsqueezy`
3. Select the following events:
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_resumed`
   - `subscription_expired`
   - `subscription_payment_success`
   - `subscription_payment_failed`
   - `order_created`
4. Copy the webhook signing secret

### 7. Configure Environment Variables

Add the following variables to your `.env` file:

```env
# Lemon Squeezy Configuration
LEMONSQUEEZY_API_KEY=your_api_key_here
LEMONSQUEEZY_STORE_ID=your_store_id_here
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_signing_secret_here

# Monthly Plan Variant IDs
LEMONSQUEEZY_STARTER_MONTHLY_VARIANT_ID=123456
LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID=123457
LEMONSQUEEZY_BUSINESS_MONTHLY_VARIANT_ID=123458
LEMONSQUEEZY_ENTERPRISE_MONTHLY_VARIANT_ID=123459

# Yearly Plan Variant IDs
LEMONSQUEEZY_STARTER_YEARLY_VARIANT_ID=123460
LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID=123461
LEMONSQUEEZY_BUSINESS_YEARLY_VARIANT_ID=123462
LEMONSQUEEZY_ENTERPRISE_YEARLY_VARIANT_ID=123463

# Message Pack Variant IDs
LEMONSQUEEZY_PACK_100_VARIANT_ID=123464
LEMONSQUEEZY_PACK_500_VARIANT_ID=123465
LEMONSQUEEZY_PACK_1000_VARIANT_ID=123466

# App URL (for redirects after payment)
NEXT_PUBLIC_APP_URL=https://staffix.io
```

## Database Migration

After adding Lemon Squeezy fields to the Prisma schema, run:

```bash
npx prisma db push
# or
npx prisma migrate dev --name add-lemonsqueezy-fields
```

## Testing

### Test Mode

Lemon Squeezy provides a test mode:
1. Toggle "Test Mode" in your Lemon Squeezy dashboard
2. Use test API keys
3. Use test card numbers:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`

### Webhook Testing

Use tools like [ngrok](https://ngrok.com) to expose your local server:

```bash
ngrok http 3000
```

Then update your webhook URL in Lemon Squeezy to the ngrok URL.

## Payment Flow

1. User selects a plan on `/pricing`
2. User clicks "Pay" on `/checkout`
3. API creates Lemon Squeezy checkout session
4. User is redirected to Lemon Squeezy hosted checkout
5. User completes payment
6. Lemon Squeezy sends webhook to `/api/webhooks/lemonsqueezy`
7. Webhook updates subscription in database
8. User is redirected to `/checkout/success`

## Subscription Management

Users can manage their subscription in **Settings > Subscription**:
- View current plan and usage
- Cancel subscription (keeps access until end of period)
- Resume cancelled subscription
- Upgrade/downgrade plan

## Support

- Lemon Squeezy Documentation: https://docs.lemonsqueezy.com
- Lemon Squeezy Support: https://lemonsqueezy.com/help
