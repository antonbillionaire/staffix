# Staffix — Адаптация для магазинов и товарного бизнеса

## Концепция

Сейчас Staffix работает как **сервисная платформа** (записи на услуги). Нужно добавить второй режим — **товарный бизнес** (заказы на продукты).

**Ключевое различие:**
| | Сервисный бизнес | Товарный бизнес (магазин) |
|---|---|---|
| Основная единица | Услуга (стрижка, массаж) | Товар (продукт, изделие) |
| Действие клиента | Записывается на время | Оформляет заказ |
| Мастер/сотрудник | Выполняет услугу в назначенное время | Собирает и отправляет заказ |
| Время | Критично (слот в расписании) | Не привязано к конкретному времени |
| CRM | История посещений | История покупок |
| Напоминания | За 24ч/2ч до визита | Статус заказа (собирается, отправлен, доставлен) |

---

## Архитектура: что менять

### 1. Модель Business — добавить режим

```prisma
model Business {
  // Существующее поле:
  businessType  String?   // salon, clinic, barbershop, auto_service, other

  // НОВОЕ:
  businessMode  String    @default("service") // "service" | "shop"
}
```

Когда `businessMode = "shop"`:
- Вместо "Услуги" показывать "Товары"
- Вместо "Записи" показывать "Заказы"
- Вместо расписания мастеров — статусы заказов
- AI-сотрудник работает как консультант + приём заказов

### 2. Модель Product (новая — для товаров)

```prisma
model Product {
  id            String    @id @default(cuid())
  name          String
  description   String?
  price         Int       // в центах или минимальной единице валюты
  currency      String    @default("USD")

  // Каталог
  category      String?   // категория товара
  sku           String?   // артикул
  imageUrl      String?   // фото товара

  // Наличие
  inStock       Boolean   @default(true)
  quantity      Int?      // количество на складе (null = не отслеживаем)

  // Вес/размеры для доставки
  weight        Float?    // граммы

  businessId    String
  business      Business  @relation(...)

  orderItems    OrderItem[]
}
```

### 3. Модель Order (новая — заказы)

```prisma
model Order {
  id              String    @id @default(cuid())
  orderNumber     String    @unique // ORD-001, ORD-002...

  // Клиент
  clientName      String
  clientPhone     String?
  clientTelegramId BigInt?
  clientAddress    String?   // адрес доставки

  // Статус заказа
  status          String    @default("new")
  // new → confirmed → assembling → shipped → delivered → completed
  // new → cancelled

  // Суммы
  subtotal        Int       // сумма товаров
  deliveryFee     Int       @default(0)
  discount        Int       @default(0)
  total           Int       // итого

  // Доставка
  deliveryMethod  String?   // pickup, delivery, courier
  deliveryAddress String?
  trackingNumber  String?

  // Оплата
  paymentMethod   String?   // cash, card, transfer
  paymentStatus   String    @default("pending") // pending, paid, refunded

  // Заметки
  customerNote    String?   // пожелание клиента
  internalNote    String?   // заметка продавца

  // Дата
  confirmedAt     DateTime?
  shippedAt       DateTime?
  deliveredAt     DateTime?
  completedAt     DateTime?
  cancelledAt     DateTime?
  cancelReason    String?

  businessId      String
  business        Business  @relation(...)

  items           OrderItem[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([businessId, status])
  @@index([businessId, createdAt])
}

model OrderItem {
  id          String    @id @default(cuid())

  productId   String
  product     Product   @relation(...)

  orderId     String
  order       Order     @relation(...)

  quantity    Int       @default(1)
  price       Int       // цена на момент заказа

  @@index([orderId])
}
```

### 4. Изменения в UI (дашборд)

| Текущая страница | Сервис | Магазин |
|---|---|---|
| `/dashboard/services` | Список услуг | Каталог товаров (с фото, категориями, остатками) |
| `/dashboard/bookings` | Записи на услуги | Заказы (с воронкой статусов) |
| `/dashboard/calendar` | Календарь записей | Не нужен (или доска заказов Kanban) |
| `/dashboard/staff` | Мастера + расписание | Сотрудники (без расписания) |
| `/dashboard/clients` | CRM клиентов | CRM покупателей (история покупок) |
| `/dashboard/analytics` | Метрики записей | Метрики продаж (средний чек, популярные товары) |

**Подход:** Не дублировать страницы, а показывать разный контент в зависимости от `businessMode`.

### 5. AI-сотрудник для магазина

System prompt адаптируется:
- Знает каталог товаров (названия, цены, описания, наличие)
- Принимает заказы через диалог
- Уточняет количество, адрес доставки
- Отправляет статус заказа клиенту
- Рекомендует товары на основе предпочтений

### 6. Уведомления для магазина

| Событие | Владельцу | Клиенту |
|---|---|---|
| Новый заказ | "Новый заказ #ORD-015 от Алии на 25,000 тг" | "Ваш заказ #ORD-015 принят!" |
| Подтверждение | — | "Заказ подтверждён, собираем!" |
| Отправка | — | "Заказ отправлен! Трекинг: ..." |
| Доставка | — | "Заказ доставлен! Оцените покупку" |

---

## Интеграция с 1С и другими CRM

### Варианты интеграции

**Вариант A: API интеграция (рекомендуется)**
```
Staffix ←→ REST API ←→ 1С/другая CRM
```
- Staffix предоставляет REST API для заказов, товаров, клиентов
- 1С (или другая CRM) синхронизирует данные через API
- Двусторонняя синхронизация: заказы из Staffix → 1С, остатки из 1С → Staffix

**Вариант B: Webhook интеграция**
```
Staffix → Webhook → 1С
1С → Staffix API → Staffix
```
- При создании/обновлении заказа Staffix отправляет webhook
- 1С обновляет остатки через Staffix API

**Вариант C: Промежуточный сервис (для сложных случаев)**
```
Staffix ←→ Integration Hub ←→ 1С, AmoCRM, Bitrix24, etc.
```

### Что нужно для интеграции с 1С

1. **Staffix Public API** — REST endpoints:
   - `GET /api/v1/products` — каталог товаров
   - `POST /api/v1/products` — добавить/обновить товар
   - `GET /api/v1/orders` — список заказов
   - `PATCH /api/v1/orders/:id` — обновить статус
   - `GET /api/v1/clients` — база клиентов
   - `POST /api/v1/webhooks` — настройка вебхуков

2. **Webhook events:**
   - `order.created` — новый заказ
   - `order.updated` — изменение статуса
   - `order.completed` — заказ завершён
   - `product.low_stock` — мало товара на складе
   - `client.created` — новый клиент

3. **1С-специфичное:**
   - Модуль обмена для 1С (или инструкция для 1С-программиста)
   - Маппинг полей Staffix ↔ 1С (номенклатура, контрагенты, заказы)
   - Синхронизация остатков: 1С → Staffix (по расписанию или событию)

---

## План реализации (фазы)

### Фаза 1: Базовый магазин (MVP)
- [ ] Поле `businessMode` в Business
- [ ] Модели Product, Order, OrderItem
- [ ] Страница каталога товаров (`/dashboard/products`)
- [ ] Страница заказов (`/dashboard/orders`)
- [ ] AI-промпт для магазина (консультация + приём заказов)
- [ ] Уведомления о заказах

### Фаза 2: Управление заказами
- [ ] Kanban-доска заказов (new → confirmed → shipped → delivered)
- [ ] Смена статуса заказа с уведомлением клиенту
- [ ] Аналитика продаж (средний чек, популярные товары, выручка)
- [ ] Управление остатками на складе

### Фаза 3: Интеграции
- [ ] REST API для внешних систем
- [ ] Webhook система
- [ ] Документация API
- [ ] Модуль обмена с 1С (инструкция + базовый коннектор)
- [ ] Интеграция с AmoCRM / Bitrix24 (опционально)

---

## Важные решения

1. **Один дашборд vs два:** Рекомендуется один дашборд с переключением режима через `businessMode`. Меньше кода, проще поддержка.

2. **Валюта:** Добавить поле `currency` в Business (KZT, UZS, RUB, USD). Сейчас цены в Service хранятся как Int — оставить так же.

3. **Фото товаров:** Использовать тот же механизм загрузки что и для логотипов ботов. Хранить в Vercel Blob или base64.

4. **Обратная совместимость:** Существующие бизнесы с `businessMode = null` по умолчанию работают как `"service"`. Ничего не сломается.

---

*Документ подготовлен: Feb 18, 2026*
