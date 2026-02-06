# Staffix Scaling Architecture
## Цель: 10,000+ клиентов на тарифе Business

---

## 1. Расчет нагрузки

### Сценарий: 10,000 клиентов на Business ($100/мес, 3000 сообщений)
- **Максимум сообщений/месяц**: 10,000 × 3,000 = 30,000,000 сообщений
- **Среднее в день**: 1,000,000 сообщений
- **Пик (рабочие часы)**: ~100,000 сообщений/час = ~28 запросов/секунду

### Revenue при 10,000 клиентов Business
- MRR: 10,000 × $100 = **$1,000,000/месяц**
- ARR: **$12,000,000/год**

---

## 2. AI Context Memory (Память о клиентах)

### Проблема
Claude API stateless - не помнит предыдущие разговоры между запросами.

### Решение: Conversation Memory System

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT MESSAGE                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              1. LOAD CLIENT CONTEXT                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  - Client profile (name, phone, preferences)    │    │
│  │  - Last 10 conversations (summarized)           │    │
│  │  - Booking history                              │    │
│  │  - Important notes                              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              2. BUILD CLAUDE PROMPT                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  System: Business context + AI rules            │    │
│  │  Context: Client history (from DB)              │    │
│  │  Messages: Current conversation                 │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              3. CLAUDE API RESPONSE                      │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              4. SAVE TO DATABASE                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  - Save message + response                      │    │
│  │  - Update client summary (async)                │    │
│  │  - Extract important info (async)               │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Database Schema для Memory

```prisma
model Client {
  id            String   @id @default(cuid())
  telegramId    String   @unique
  businessId    String

  // Profile
  name          String?
  phone         String?
  email         String?

  // AI Memory
  summary       String?  @db.Text  // AI-generated summary of client
  preferences   Json?              // Extracted preferences
  importantNotes String? @db.Text  // Manual notes from business

  // Stats
  totalMessages Int      @default(0)
  lastMessageAt DateTime?

  conversations Conversation[]
  bookings      Booking[]

  business      Business @relation(fields: [businessId], references: [id])

  @@index([businessId])
  @@index([telegramId])
}

model Conversation {
  id        String   @id @default(cuid())
  clientId  String

  // Messages stored as JSON array for efficiency
  messages  Json     // [{role: "user", content: "..."}, {role: "assistant", content: "..."}]

  // Summary for long-term memory
  summary   String?  @db.Text

  startedAt DateTime @default(now())
  endedAt   DateTime?

  client    Client   @relation(fields: [clientId], references: [id])

  @@index([clientId])
  @@index([startedAt])
}
```

### Context Window Management

```typescript
async function buildClientContext(clientId: string, maxTokens: number = 2000) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      conversations: {
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: { summary: true }
      },
      bookings: {
        orderBy: { date: 'desc' },
        take: 3
      }
    }
  });

  return `
## О клиенте
Имя: ${client.name || 'Не указано'}
Телефон: ${client.phone || 'Не указан'}
Всего обращений: ${client.totalMessages}

## Краткая история
${client.summary || 'Новый клиент'}

## Последние визиты
${client.bookings.map(b => `- ${b.date}: ${b.service}`).join('\n')}

## Важные заметки
${client.importantNotes || 'Нет'}
  `.trim();
}
```

---

## 3. Infrastructure Scaling

### Option A: Vercel Pro + Serverless (Текущий путь)
**Подходит для: до 50,000 клиентов**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Vercel    │────▶│  Vercel     │────▶│  Anthropic  │
│   Edge      │     │  Postgres   │     │  Claude API │
│   Functions │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Стоимость при 10,000 клиентов:**
- Vercel Pro: $20/мес
- Vercel Postgres: ~$500/мес (50GB, high usage)
- Claude API: ~$15,000-30,000/мес (зависит от использования)
- **Total: ~$16,000-31,000/мес**

**Margin: $1,000,000 - $31,000 = $969,000/мес (96.9%)**

### Option B: Dedicated Infrastructure (для 50,000+ клиентов)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Cloudflare │────▶│  Railway/   │────▶│  Anthropic  │
│  Workers    │     │  Fly.io     │     │  Claude API │
│             │     │  (Node.js)  │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
        │                   │
        │           ┌───────┴───────┐
        │           │               │
        ▼           ▼               ▼
┌─────────────┐ ┌─────────┐ ┌─────────────┐
│    Redis    │ │ Postgres│ │   S3/R2     │
│   (Cache)   │ │ (Main)  │ │  (Files)    │
└─────────────┘ └─────────┘ └─────────────┘
```

### Option C: Enterprise Scale (100,000+ клиентов)

```
┌──────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                          │
│                   (Cloudflare/AWS)                        │
└──────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  API     │    │  API     │    │  API     │
    │ Server 1 │    │ Server 2 │    │ Server N │
    └──────────┘    └──────────┘    └──────────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
    ┌──────────────────────────────────────────────────────┐
    │                    MESSAGE QUEUE                      │
    │               (Redis/RabbitMQ/SQS)                    │
    └──────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Worker  │    │  Worker  │    │  Worker  │
    │    1     │    │    2     │    │    N     │
    └──────────┘    └──────────┘    └──────────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
    ┌──────────────────────────────────────────────────────┐
    │              POSTGRES CLUSTER                         │
    │         (Primary + Read Replicas)                     │
    └──────────────────────────────────────────────────────┘
```

---

## 4. Claude API Optimization

### Rate Limits (Anthropic)
- Tier 1: 60 requests/min, 100K tokens/min
- Tier 2: 1,000 requests/min, 500K tokens/min
- Tier 3: 2,000 requests/min, 2M tokens/min
- Tier 4: 4,000 requests/min, 4M tokens/min

**Для 28 req/sec нужен Tier 4** (свяжитесь с Anthropic для enterprise)

### Token Optimization

```typescript
// Используем Claude Haiku для простых вопросов
// Claude Sonnet для сложных

function selectModel(message: string, conversationLength: number): string {
  const simplePatterns = [
    /цен[аы]/i,
    /сколько стоит/i,
    /график работы/i,
    /адрес/i,
    /телефон/i,
  ];

  const isSimple = simplePatterns.some(p => p.test(message));

  if (isSimple && conversationLength < 3) {
    return 'claude-3-haiku-20240307';  // $0.25/1M input
  }

  return 'claude-sonnet-4-20250514';    // $3/1M input
}
```

### Cost Estimate

| Model | Input/1M | Output/1M | Avg per msg | 30M msgs/mo |
|-------|----------|-----------|-------------|-------------|
| Haiku | $0.25 | $1.25 | $0.0005 | $15,000 |
| Sonnet | $3 | $15 | $0.005 | $150,000 |
| Mixed (70/30) | - | - | $0.002 | $60,000 |

**Рекомендация: Mixed approach = ~$60,000/мес при 10K клиентов**

---

## 5. Caching Strategy

### Redis для кэширования

```typescript
// Кэш бизнес-контекста (меняется редко)
const businessContext = await redis.get(`business:${businessId}:context`);
if (!businessContext) {
  const context = await loadBusinessContext(businessId);
  await redis.setex(`business:${businessId}:context`, 3600, context); // 1 час
}

// Кэш клиентского профиля
const clientProfile = await redis.get(`client:${clientId}:profile`);
if (!clientProfile) {
  const profile = await loadClientProfile(clientId);
  await redis.setex(`client:${clientId}:profile`, 300, profile); // 5 минут
}
```

### Conversation Summarization (Background Job)

```typescript
// Каждые 10 сообщений - создаем саммари
async function summarizeConversation(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  });

  const summary = await claude.messages.create({
    model: 'claude-3-haiku-20240307',
    messages: [{
      role: 'user',
      content: `Summarize this conversation in 2-3 sentences, focusing on:
      - What the client wanted
      - Key decisions made
      - Any preferences expressed

      Conversation:
      ${JSON.stringify(conversation.messages)}`
    }]
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { summary: summary.content[0].text }
  });
}
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Current - 1,000 клиентов)
- [x] Basic conversation storage
- [ ] Client profiles with memory
- [ ] Conversation summarization
- [ ] Basic caching (Redis)

### Phase 2: Scale (1,000 - 10,000 клиентов)
- [ ] Model routing (Haiku/Sonnet)
- [ ] Background job processing
- [ ] Database read replicas
- [ ] Monitoring & alerting

### Phase 3: Enterprise (10,000+ клиентов)
- [ ] Message queue architecture
- [ ] Multi-region deployment
- [ ] Custom Claude enterprise agreement
- [ ] Advanced analytics

---

## 7. Cost Summary at 10,000 Business Clients

| Item | Monthly Cost |
|------|-------------|
| Claude API (mixed) | $60,000 |
| Vercel/Infrastructure | $2,000 |
| Redis (Upstash) | $500 |
| Postgres (managed) | $1,000 |
| Monitoring (Datadog) | $500 |
| **Total** | **$64,000** |

**Revenue: $1,000,000/мес**
**Costs: $64,000/мес**
**Gross Margin: $936,000/мес (93.6%)**

---

## 8. Key Metrics to Monitor

```typescript
// Metrics to track
const metrics = {
  // Performance
  avgResponseTime: 'ms',
  p95ResponseTime: 'ms',
  errorRate: '%',

  // Usage
  messagesPerDay: 'count',
  uniqueClientsPerDay: 'count',
  tokensUsedPerDay: 'count',

  // Costs
  claudeCostPerDay: 'USD',
  costPerMessage: 'USD',
  costPerClient: 'USD',

  // Quality
  conversationLength: 'avg messages',
  clientReturnRate: '%',
  bookingConversionRate: '%'
};
```

---

## Conclusion

С правильной архитектурой Staffix может обслуживать 10,000+ клиентов на тарифе Business с:
- **Gross margin 93%+**
- **AI помнит каждого клиента** через систему memory + summarization
- **Мощностей всегда хватит** через автомасштабирование + message queues
- **Оптимизация расходов** через умный выбор моделей (Haiku vs Sonnet)
