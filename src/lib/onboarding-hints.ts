/**
 * Onboarding page hints (22 июля 2026).
 *
 * Каждая страница дашборда, где владельцу нужно что-то настроить, имеет
 * contextual banner с 3 частями: title / description / howTo. Баннер
 * рендерится компонентом <PageHint id="..." />. Скрывается двумя способами:
 *   1. Владелец нажал «Понятно, скрыть» → pageId попадает в Business.hintsDismissed
 *   2. Условие "done" выполнилось (например ≥3 услуги) → detector вернёт true
 *
 * Тексты сейчас только на русском — язык платформы владельца в CIS. Добавить
 * en/uz/kz можно расширением HintContent (см. faq-content.ts паттерн).
 */

import { prisma } from "@/lib/prisma";

export type PageHintId =
  | "business"
  | "services"
  | "products"
  | "knowledge"
  | "staff"
  | "bot"
  | "channels"
  | "broadcasts"
  | "automation"
  | "loyalty"
  | "widget"
  | "ads"
  | "customers-empty"
  | "statistics-empty"
  | "bookings-empty"
  | "orders-empty"
  | "activity";

export interface HintContent {
  title: string;
  description: string;
  howTo: string; // markdown-like, поддерживает \n
  /** Обязателен ли для запуска (влияет на глобальный шагомер). */
  required: boolean;
  /** Для empty-state баннеров (всегда, а не только при онбординге). */
  emptyState?: boolean;
  /** Порядок для шагомера. */
  order: number;
}

export const HINTS: Record<PageHintId, HintContent> = {
  business: {
    title: "Расскажите Staffix о вашем бизнесе",
    description:
      "Название, тип, часовой пояс и рабочие часы попадают в промпт вашего ИИ сотрудника — без них он не сможет корректно отвечать на «когда вы работаете?» или «как вас найти?».",
    howTo:
      "Заполните поля профиля → нажмите «Сохранить». Часовой пояс важен для правильного времени в записях и рассылках.",
    required: true,
    order: 1,
  },

  services: {
    title: "Ваш каталог услуг",
    description:
      "Список услуг с ценами и длительностью. Ваш ИИ сотрудник использует его чтобы отвечать на вопросы клиентов и создавать записи в календарь.",
    howTo:
      "«Добавить услугу» → название, цена, длительность в минутах, короткое описание. Минимум 3-5 услуг чтобы ИИ сотрудник мог их предлагать.",
    required: true,
    order: 2,
  },

  products: {
    title: "Ваш каталог товаров",
    description:
      "Список товаров с ценами и остатками. Ваш ИИ сотрудник предлагает их клиентам, оформляет заказы, отслеживает склад.",
    howTo:
      "«Добавить товар» вручную или «Импорт» — загрузите CSV/Excel/PDF со списком, Staffix распознает автоматически. Можно добавить фото.",
    required: true,
    order: 2,
  },

  knowledge: {
    title: "База знаний вашего бизнеса",
    description:
      "Два источника правды для вашего ИИ сотрудника: документы (прайс, программы, правила) и FAQ (пары вопрос-ответ). Загруженное здесь бот использует чтобы отвечать точно по вашим данным, а не выдумывать.",
    howTo:
      "**Документы**: «Загрузить документ» → выберите PDF или Word → Staffix за 30 секунд извлечёт текст. Хорошо работают: прайс-листы, программы курсов, правила отмены.\n\n**FAQ**: «Добавить FAQ» → вопрос + ответ. Начните с 5-10 частых: «Работаете в выходные?», «Есть ли доставка?», «Сколько стоит X?».",
    required: true,
    order: 3,
  },

  staff: {
    title: "Команда и уведомления в Telegram",
    description:
      "Добавьте сотрудников (менеджеров, мастеров, операторов) — Staffix будет отправлять им уведомления о новых клиентах прямо в Telegram. Каждый получает свою ссылку на ИИ сотрудника, чтобы клиенты попадали именно к нему.",
    howTo:
      "1. «Добавить сотрудника» → имя + роль (мастер / менеджер / администратор)\n2. Попросите сотрудника написать `/start` в чат с вашим ИИ сотрудником → его Telegram привяжется автоматически\n3. Скопируйте его персональную ссылку и передайте — она приводит клиентов лично к нему",
    required: true,
    order: 4,
  },

  bot: {
    title: "Как ваш ИИ сотрудник говорит с клиентами",
    description:
      "Приветственное сообщение (первое что видит новый клиент), тон общения (профессиональный / дружелюбный / неформальный), особые правила («всегда уточняй телефон», «не обсуждай политику»).",
    howTo:
      "Напишите приветствие в поле «Welcome message». Клиент видит именно ваше приветствие; чтобы он ощущал вас, а не Staffix — не начинайте с «Я AI-помощник», а сразу к делу («Здравствуйте! Салон красоты Название. Чем могу помочь?»). Выберите тон. В «Правила» можно добавить специфику: «В пятницу всегда упоминай акцию понедельника».",
    required: true,
    order: 5,
  },

  channels: {
    title: "Куда клиенты пишут вашему ИИ сотруднику",
    description:
      "Мессенджеры где ваш ИИ сотрудник принимает клиентов. Telegram проще всего подключить (5 минут). WhatsApp, Instagram, Facebook — через Meta OAuth (10 минут, нужен FB-аккаунт).",
    howTo:
      "**Telegram**: найдите `@BotFather` в Telegram → `/newbot` → задайте имя → скопируйте токен → вставьте в поле «Telegram Bot Token» → «Подключить».\n\n**Meta (WA/IG/FB)**: «Подключить через Facebook» → войдите в FB Business → выберите страницу и Instagram-аккаунт → всё подключится автоматически.",
    required: true,
    order: 6,
  },

  broadcasts: {
    title: "Рассылки клиентам",
    description:
      "Отправляйте сообщения всем клиентам сразу — акции, новости, напоминания. Работает по Telegram и Email. Можно выбрать сегмент: VIP-клиенты, активные, спящие.",
    howTo:
      "«Создать рассылку» → напишите текст (переменная `{{имя}}` подставит имя клиента) → выберите канал (Telegram / Email / Оба) → сегмент → отправить сейчас или запланировать.",
    required: false,
    order: 7,
  },

  automation: {
    title: "Автоматические напоминания и реактивация",
    description:
      "Staffix сам напомнит клиенту за 24 часа и за 2 часа до записи, попросит отзыв после визита, вернёт «спящего» клиента через 60 дней с промокодом.",
    howTo:
      "Включите тумблеры нужных автоматизаций. Настройте текст напоминаний под ваш тон. Проверьте что автоматизация «Реактивация» использует ваш реальный размер скидки.",
    required: false,
    order: 8,
  },

  loyalty: {
    title: "Программа лояльности",
    description:
      "Начисляйте баллы за визиты и покупки, давайте скидки VIP-клиентам, вернёте постоянного клиента даже если он попробует конкурента. Работает во всех каналах одинаково.",
    howTo:
      "Выберите тип программы — «кэшбэк» (процент возврата с каждой покупки) или «уровни» (бронзовый / серебряный / золотой по сумме визитов). Настройте пороги и скидки.",
    required: false,
    order: 9,
  },

  widget: {
    title: "Виджет чата на ваш сайт",
    description:
      "Плавающая кнопка в углу сайта — посетитель кликает и разговаривает с вашим ИИ сотрудником прямо на сайте. Внизу окна — кнопки TG/WA/IG для тех кто предпочитает мессенджер.",
    howTo:
      "1. Настройте цвет и иконку виджета выше\n2. Нажмите «Скопировать код»\n3. Вставьте одну строку на свой сайт перед `</body>` (инструкция для WordPress / Tilda / Wix ниже)\n\nВиджет обновляется автоматически — новый канал подключили, кнопка появится через 5 минут без переустановки.",
    required: false,
    order: 10,
  },

  ads: {
    title: "Данные вашей рекламы Instagram / Facebook",
    description:
      "Если запускаете рекламу в Meta — Staffix покажет сколько потрачено, CPL, воронку от клика по рекламе до записи. Не нужно вручную сверять кабинет Meta с базой Staffix.",
    howTo:
      "Найдите ID вашего рекламного аккаунта в Meta Ads Manager (формат `123456789012`) → введите в «Каналы → Meta → Рекламный аккаунт» → сохраните. Данные подтянутся в течение суток или сразу по кнопке «Обновить».",
    required: false,
    order: 11,
  },

  // ── Empty states (не влияют на шагомер, всегда показываются пока пусто) ──

  "customers-empty": {
    title: "Клиенты появятся автоматически",
    description:
      "Как только человек напишет вашему ИИ сотруднику в любом из подключённых мессенджеров или в виджете сайта — он появится здесь. Проверьте что каналы подключены, напишите сами вашему ИИ сотруднику `/start` — вы станете первым клиентом в базе.",
    howTo: "",
    required: false,
    emptyState: true,
    order: 100,
  },

  "statistics-empty": {
    title: "Статистика собирается",
    description:
      "Здесь появятся графики по сообщениям, диалогам, конверсиям и рекламе. Пока диалогов мало, чтобы построить графики. Попросите нескольких клиентов написать ИИ сотруднику, через 3-5 дней статистика станет содержательной.",
    howTo: "",
    required: false,
    emptyState: true,
    order: 101,
  },

  "bookings-empty": {
    title: "Записи появятся когда клиенты начнут бронировать",
    description:
      "Staffix создаёт записи автоматически когда клиент договаривается о времени в мессенджере с вашим ИИ сотрудником. Убедитесь что каталог услуг и расписание сотрудников заполнены — без них ИИ сотрудник не сможет предлагать слоты.",
    howTo: "",
    required: false,
    emptyState: true,
    order: 102,
  },

  "orders-empty": {
    title: "Заказы появятся когда клиенты начнут покупать",
    description:
      "Staffix создаёт заказ автоматически когда клиент выбирает товары в мессенджере у вашего ИИ сотрудника. Убедитесь что каталог товаров и способы оплаты настроены — без них клиент не сможет оформить.",
    howTo: "",
    required: false,
    emptyState: true,
    order: 103,
  },

  activity: {
    title: "Журнал работы ИИ сотрудника",
    description:
      "Здесь виден каждый шаг вашего ИИ сотрудника — какой инструмент вызвал, что ответил клиенту, где эскалировал вам. Полезно если что-то пошло не так или клиент жалуется на неправильный ответ.",
    howTo: "",
    required: false,
    order: 104,
  },
};

/**
 * Автоматически определяет выполнен ли шаг для конкретного бизнеса.
 * Смотрит в БД по каждому pageId. Возвращает true если шаг сделан
 * (баннер должен быть скрыт).
 */
export async function computeHintDone(
  businessId: string,
  pageId: PageHintId
): Promise<boolean> {
  try {
    switch (pageId) {
      case "business": {
        const b = await prisma.business.findUnique({
          where: { id: businessId },
          select: { name: true, businessType: true, timezone: true },
        });
        return !!(b?.name && b.businessType && b.timezone);
      }
      case "services": {
        const c = await prisma.service.count({ where: { businessId } });
        return c >= 3;
      }
      case "products": {
        const c = await prisma.product.count({ where: { businessId } });
        return c >= 3;
      }
      case "knowledge": {
        // Считается сделанным если ≥1 документ ИЛИ ≥5 FAQ.
        const [docs, faqs] = await Promise.all([
          prisma.document.count({ where: { businessId, parsed: true } }),
          prisma.fAQ.count({ where: { businessId } }),
        ]);
        return docs >= 1 || faqs >= 5;
      }
      case "staff": {
        const c = await prisma.staff.count({
          where: { businessId, telegramChatId: { not: null } },
        });
        return c >= 1;
      }
      case "bot": {
        const b = await prisma.business.findUnique({
          where: { id: businessId },
          select: { welcomeMessage: true, aiTone: true },
        });
        return !!(b?.welcomeMessage && b.aiTone);
      }
      case "channels": {
        const b = await prisma.business.findUnique({
          where: { id: businessId },
          select: { botActive: true, waActive: true, igActive: true, fbActive: true },
        });
        return !!(b?.botActive || b?.waActive || b?.igActive || b?.fbActive);
      }
      case "broadcasts": {
        const c = await prisma.clientBroadcast.count({ where: { businessId } });
        return c >= 1;
      }
      case "automation": {
        const s = await prisma.automationSettings.findFirst({ where: { businessId } });
        return !!(
          s &&
          (s.reminder24hEnabled ||
            s.reminder2hEnabled ||
            s.reviewEnabled ||
            s.reactivationEnabled)
        );
      }
      case "loyalty": {
        const p = await prisma.loyaltyProgram.findFirst({
          where: { businessId, enabled: true },
        });
        return !!p;
      }
      case "ads": {
        const b = await prisma.business.findUnique({
          where: { id: businessId },
          select: { fbAdAccountId: true },
        });
        return !!b?.fbAdAccountId;
      }
      case "widget":
        // widget нет автоматического "done" — только ручной dismiss
        return false;

      // Empty states — done когда данные появились
      case "customers-empty": {
        const c = await prisma.client.count({ where: { businessId } });
        return c > 0;
      }
      case "statistics-empty": {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const c = await prisma.message.count({
          where: {
            conversation: { businessId },
            createdAt: { gte: sevenDaysAgo },
          },
        });
        return c > 20;
      }
      case "bookings-empty": {
        const c = await prisma.booking.count({ where: { businessId } });
        return c > 0;
      }
      case "orders-empty": {
        const c = await prisma.order.count({ where: { businessId } });
        return c > 0;
      }
      case "activity":
        // Справочная страница — не скрывается автоматически
        return false;
    }
  } catch (e) {
    console.error(`[onboarding-hints] computeHintDone(${pageId}) failed:`, e);
    return false; // при ошибке показываем баннер (безопаснее)
  }
}

/**
 * Возвращает статус всех баннеров для бизнеса + счётчик обязательных шагов.
 * Используется endpoint'ом /api/onboarding/hints-state.
 */
export interface HintsState {
  /** По pageId: { done, dismissed } */
  states: Record<PageHintId, { done: boolean; dismissed: boolean }>;
  /** Прогресс обязательных шагов (для глобального шагомера). */
  requiredTotal: number;
  requiredDone: number;
  /** ID следующего невыполненного обязательного шага (для кнопки "Что дальше →"). */
  nextRequiredId: PageHintId | null;
}

export async function getHintsState(businessId: string): Promise<HintsState> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { hintsDismissed: true, dashboardMode: true },
  });
  const dismissedSet = new Set(biz?.hintsDismissed ?? []);
  const isSales = biz?.dashboardMode === "sales";

  const pageIds = Object.keys(HINTS) as PageHintId[];
  const states = {} as Record<PageHintId, { done: boolean; dismissed: boolean }>;

  // Параллельно считаем done для всех
  const doneResults = await Promise.all(
    pageIds.map((id) => computeHintDone(businessId, id).then((done) => [id, done] as const))
  );
  for (const [id, done] of doneResults) {
    states[id] = { done, dismissed: dismissedSet.has(id) };
  }

  // Считаем прогресс обязательных шагов. В service-mode products не считается,
  // в sales-mode — services и bookings-empty не считаются.
  const requiredIds = pageIds.filter((id) => {
    if (!HINTS[id].required) return false;
    if (id === "products" && !isSales) return false;
    if (id === "services" && isSales) return false;
    return true;
  });
  const requiredDone = requiredIds.filter((id) => states[id].done).length;
  const nextRequiredId =
    requiredIds
      .sort((a, b) => HINTS[a].order - HINTS[b].order)
      .find((id) => !states[id].done) ?? null;

  return {
    states,
    requiredTotal: requiredIds.length,
    requiredDone,
    nextRequiredId,
  };
}
