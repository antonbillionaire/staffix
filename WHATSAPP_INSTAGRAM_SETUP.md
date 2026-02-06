# WhatsApp & Instagram Integration Setup

## Overview

Staffix supports multi-channel messaging through:
- **Telegram** (already working)
- **WhatsApp Business API** (prepared, needs Meta verification)
- **Instagram Messaging API** (prepared, needs Meta verification)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      STAFFIX AI                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐             │
│  │ Telegram  │   │ WhatsApp  │   │ Instagram │             │
│  │    Bot    │   │ Business  │   │    DM     │             │
│  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘             │
│        │               │               │                    │
│        └───────────────┼───────────────┘                    │
│                        ▼                                    │
│              ┌─────────────────┐                           │
│              │  Message Handler │                           │
│              │  (messageHandler)│                           │
│              └────────┬────────┘                           │
│                       ▼                                     │
│              ┌─────────────────┐                           │
│              │   AI Employee   │                           │
│              │   (Same as TG)  │                           │
│              └─────────────────┘                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Files Created

### Core Types
- `src/lib/channels/types.ts` - Unified message types
- `src/lib/channels/provider.ts` - Provider interface and manager
- `src/lib/channels/index.ts` - Exports

### Channel Providers
- `src/lib/channels/whatsapp.ts` - WhatsApp Cloud API provider
- `src/lib/channels/instagram.ts` - Instagram Graph API provider

### API Endpoints
- `src/app/api/webhooks/whatsapp/route.ts` - WhatsApp webhook handler
- `src/app/api/webhooks/instagram/route.ts` - Instagram webhook handler
- `src/app/api/channels/route.ts` - Channel management API

### Message Handler
- `src/lib/channels/messageHandler.ts` - Unified message processing with AI

### Database
- Added to `prisma/schema.prisma`:
  - `ChannelConnection` - Channel connection settings
  - `ChannelClient` - Unified client across channels
  - `ChannelMessage` - Messages from all channels
  - `Lead` - Leads from ads (Instagram/WhatsApp)

### UI
- `src/app/dashboard/channels/page.tsx` - Channel management page

## Setup Steps

### 1. Prerequisites

1. **Meta Business Account** - Verified business in Meta Business Suite
2. **Company Website** - Required for verification
3. **Business Documents** - Registration certificate, etc.

### 2. Meta App Setup

1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create a new app (Business type)
3. Add products:
   - WhatsApp
   - Instagram Graph API

### 3. WhatsApp Business API Setup

1. In Meta Business Suite, go to WhatsApp Manager
2. Create a WhatsApp Business Account
3. Add a phone number (must not be registered in WhatsApp)
4. Get Phone Number ID from API Setup
5. Generate Access Token

### 4. Instagram API Setup

1. Connect Instagram Business Account to Facebook Page
2. In Instagram settings: Privacy > Messages > Allow Access
3. Get Instagram Account ID and Page ID
4. Generate Access Token

### 5. Environment Variables

Add to `.env`:

```env
# Meta App Settings
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_VERIFY_TOKEN=your_verify_token  # Custom string for webhook verification

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_ACCESS_TOKEN=your_access_token

# Instagram
INSTAGRAM_ACCOUNT_ID=your_instagram_account_id
INSTAGRAM_PAGE_ID=your_page_id
INSTAGRAM_ACCESS_TOKEN=your_access_token
```

### 6. Webhook Configuration

In Meta App Dashboard:

**WhatsApp Webhook:**
- URL: `https://your-domain.com/api/webhooks/whatsapp`
- Verify Token: Same as `META_VERIFY_TOKEN`
- Subscribe to: `messages`, `message_deliveries`, `message_reads`

**Instagram Webhook:**
- URL: `https://your-domain.com/api/webhooks/instagram`
- Verify Token: Same as `META_VERIFY_TOKEN`
- Subscribe to: `messages`, `messaging_postbacks`, `messaging_optins`

### 7. Database Migration

```bash
npx prisma db push
# or
npx prisma migrate dev --name add-multichannel
```

## Key Features

### Lead Capture from Ads

When a user clicks on:
- **Instagram Ad** → Opens DM → AI responds → Lead captured
- **Click-to-WhatsApp Ad** → Opens WhatsApp → AI responds → Lead captured

The system automatically:
1. Identifies the lead source (ad ID)
2. Creates a Lead record
3. Notifies the business owner
4. AI greets the lead specially

### Unified Client Database

Clients are tracked across all channels:
- Same client can message from Telegram, WhatsApp, and Instagram
- All history is unified
- Business sees complete picture

### Same AI, Multiple Channels

The AI Employee:
- Uses the same knowledge base
- Same personality and instructions
- Adapts response format for each channel

## Message Limits

### WhatsApp Business API Pricing

| Message Type | Price (approx) |
|--------------|----------------|
| Service (within 24h window) | Free (first 1000/month) |
| Utility (notifications) | $0.005-0.02 |
| Marketing (promotions) | $0.02-0.08 |

### Instagram

- No per-message cost
- Standard API rate limits apply

## Testing

### WhatsApp Test Mode

1. In Meta App Dashboard, enable Test Mode
2. Use test phone number
3. Test cards: `4242 4242 4242 4242` (if payments needed)

### Instagram Sandbox

1. Add test users in App Roles
2. Test with those accounts

### Local Development

Use ngrok for webhook testing:

```bash
ngrok http 3000
```

Update webhook URLs in Meta Dashboard to ngrok URL.

## Troubleshooting

### Webhook Not Receiving Messages

1. Check webhook URL is accessible
2. Verify signature verification is working
3. Check META_APP_SECRET is correct
4. Ensure webhook subscriptions are active

### Messages Not Sending

1. Check access token is valid (not expired)
2. Verify phone number / account is approved
3. Check rate limits
4. Review Meta API error responses

### Lead Not Captured

1. Check if `referral` field is present in webhook
2. Verify Lead table exists in database
3. Check business connection is active

## Support

- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp
- Instagram API: https://developers.facebook.com/docs/instagram-api
- Meta Business Help: https://www.facebook.com/business/help
