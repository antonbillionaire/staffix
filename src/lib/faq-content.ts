// FAQ content for potential Staffix users
// Organized by categories, each question in 4 languages

export type Language = "ru" | "en" | "uz" | "kz";

export interface FaqItem {
  id: string;
  question: Record<Language, string>;
  answer: Record<Language, string>;
}

export interface FaqCategory {
  id: string;
  icon: string;
  title: Record<Language, string>;
  questions: FaqItem[];
}

export const faqCategories: FaqCategory[] = [
  // ==================== GENERAL ====================
  {
    id: "general",
    icon: "HelpCircle",
    title: {
      ru: "Общие вопросы",
      en: "General",
      uz: "Umumiy savollar",
      kz: "Жалпы сұрақтар",
    },
    questions: [
      {
        id: "what-is-staffix",
        question: {
          ru: "Что такое Staffix?",
          en: "What is Staffix?",
          uz: "Staffix nima?",
          kz: "Staffix дегеніміз не?",
        },
        answer: {
          ru: "Staffix — это SaaS-платформа, которая создаёт AI-сотрудника для вашего бизнеса. Он работает 24/7 в Telegram: отвечает на вопросы клиентов, записывает на приём, отправляет напоминания, собирает отзывы и ведёт CRM. По сути, это умный администратор, который никогда не спит и не ошибается.",
          en: "Staffix is a SaaS platform that creates an AI employee for your business. It works 24/7 in Telegram: answers client questions, books appointments, sends reminders, collects reviews, and maintains CRM. Essentially, it's a smart administrator that never sleeps and never makes mistakes.",
          uz: "Staffix — bu sizning biznesingiz uchun AI xodim yaratadigan SaaS platforma. U Telegram'da 24/7 ishlaydi: mijozlar savollariga javob beradi, uchrashuvga yozadi, eslatmalar yuboradi, sharhlar to'playdi va CRM yuritadi. Aslida, bu hech qachon uxlamaydigan va xato qilmaydigan aqlli administrator.",
          kz: "Staffix — бұл сіздің бизнесіңіз үшін AI қызметкер жасайтын SaaS платформа. Ол Telegram-да 24/7 жұмыс істейді: клиенттердің сұрақтарына жауап береді, қабылдауға жазады, еске салулар жібереді, пікірлер жинайды және CRM жүргізеді.",
        },
      },
      {
        id: "who-is-it-for",
        question: {
          ru: "Для кого подходит Staffix?",
          en: "Who is Staffix for?",
          uz: "Staffix kimlar uchun mos?",
          kz: "Staffix кімдерге арналған?",
        },
        answer: {
          ru: "Staffix идеален для любого бизнеса, работающего с клиентами по записи: салоны красоты, барбершопы, медицинские клиники, стоматологии, автосервисы, спа-центры, фитнес-клубы, рестораны, ветклиники, репетиторские центры и любые сервисные компании.",
          en: "Staffix is ideal for any appointment-based business: beauty salons, barbershops, medical clinics, dental offices, auto services, spa centers, fitness clubs, restaurants, veterinary clinics, tutoring centers, and any service company.",
          uz: "Staffix yozuv asosida ishlaydigan har qanday biznes uchun ideal: go'zallik salonlari, sartaroshxonalar, tibbiyot klinikalari, avtoservislar, spa markazlar, fitnes klublar, restoranlar va boshqa xizmat kompaniyalari.",
          kz: "Staffix жазылу бойынша жұмыс істейтін кез келген бизнес үшін тамаша: сұлулық салондары, шаштаразханалар, медициналық клиникалар, автосервистер, спа орталықтар, фитнес клубтар, мейрамханалар.",
        },
      },
      {
        id: "how-it-works",
        question: {
          ru: "Как работает AI-сотрудник?",
          en: "How does the AI employee work?",
          uz: "AI xodim qanday ishlaydi?",
          kz: "AI қызметкер қалай жұмыс істейді?",
        },
        answer: {
          ru: "Вы подключаете Telegram-бота к Staffix и загружаете информацию о вашем бизнесе: услуги, цены, часы работы, FAQ. AI-сотрудник изучает эти данные и начинает общаться с клиентами как живой администратор — отвечает на вопросы, помогает выбрать услугу, записывает на удобное время, присылает напоминания.",
          en: "You connect a Telegram bot to Staffix and upload your business info: services, prices, working hours, FAQ. The AI employee learns this data and starts communicating with clients like a real administrator — answers questions, helps choose services, books convenient times, sends reminders.",
          uz: "Siz Telegram-botni Staffix-ga ulaysiz va biznes ma'lumotlaringizni yuklaysiz: xizmatlar, narxlar, ish soatlari, FAQ. AI xodim bu ma'lumotlarni o'rganadi va mijozlar bilan haqiqiy administrator kabi muloqot qilishni boshlaydi.",
          kz: "Сіз Telegram-ботты Staffix-ке қосасыз және бизнес ақпаратыңызды жүктейсіз: қызметтер, бағалар, жұмыс уақыты, FAQ. AI қызметкер бұл деректерді үйреніп, клиенттермен нағыз әкімші сияқты сөйлесе бастайды.",
        },
      },
      {
        id: "difference-from-bots",
        question: {
          ru: "Чем Staffix отличается от обычных ботов?",
          en: "How is Staffix different from regular bots?",
          uz: "Staffix oddiy botlardan nimasi bilan farq qiladi?",
          kz: "Staffix кәдімгі боттардан несімен ерекшеленеді?",
        },
        answer: {
          ru: "Обычные боты работают по фиксированным сценариям — нажал кнопку, получил ответ. AI-сотрудник Staffix понимает живую речь, помнит каждого клиента, ведёт диалог как человек, сам находит свободное время для записи и даже собирает отзывы. Это не бот — это полноценный цифровой сотрудник.",
          en: "Regular bots follow fixed scripts — press a button, get a response. Staffix AI employee understands natural language, remembers each client, holds conversations like a human, finds available time slots, and even collects reviews. It's not a bot — it's a full-fledged digital employee.",
          uz: "Oddiy botlar belgilangan ssenariylar bo'yicha ishlaydi — tugmani bosasiz, javob olasiz. Staffix AI xodimi jonli nutqni tushunadi, har bir mijozni eslaydi, inson kabi suhbat olib boradi va hatto sharhlar yig'adi. Bu bot emas — bu to'liq raqamli xodim.",
          kz: "Кәдімгі боттар белгіленген сценарийлар бойынша жұмыс істейді — батырманы бассаңыз, жауап аласыз. Staffix AI қызметкері тірі сөзді түсінеді, әр клиентті есте сақтайды, адам сияқты сөйлеседі, тіпті пікірлер жинайды.",
        },
      },
      {
        id: "supported-languages",
        question: {
          ru: "На каких языках работает AI-сотрудник?",
          en: "What languages does the AI employee support?",
          uz: "AI xodim qaysi tillarda ishlaydi?",
          kz: "AI қызметкер қандай тілдерде жұмыс істейді?",
        },
        answer: {
          ru: "AI-сотрудник автоматически определяет язык клиента и отвечает на нём. Поддерживаются русский, английский, узбекский, казахский и десятки других языков. Интерфейс платформы доступен на русском, английском, узбекском и казахском.",
          en: "The AI employee automatically detects the client's language and responds in it. Russian, English, Uzbek, Kazakh, and dozens of other languages are supported. The platform interface is available in Russian, English, Uzbek, and Kazakh.",
          uz: "AI xodim mijozning tilini avtomatik aniqlaydi va o'sha tilda javob beradi. Rus, ingliz, o'zbek, qozoq va boshqa ko'plab tillar qo'llab-quvvatlanadi. Platforma interfeysi rus, ingliz, o'zbek va qozoq tillarida mavjud.",
          kz: "AI қызметкер клиенттің тілін автоматты түрде анықтап, сол тілде жауап береді. Орыс, ағылшын, өзбек, қазақ және басқа да көптеген тілдер қолдау көрсетіледі.",
        },
      },
    ],
  },

  // ==================== PRICING ====================
  {
    id: "pricing",
    icon: "CreditCard",
    title: {
      ru: "Тарифы и цены",
      en: "Pricing",
      uz: "Tariflar va narxlar",
      kz: "Тарифтер мен бағалар",
    },
    questions: [
      {
        id: "plan-differences",
        question: {
          ru: "Чем отличаются планы?",
          en: "What's the difference between plans?",
          uz: "Tariflar orasidagi farq nima?",
          kz: "Тарифтер арасындағы айырмашылық қандай?",
        },
        answer: {
          ru: "Все планы включают одинаковый набор функций — AI-сотрудник, CRM, рассылки, автоматизации, аналитика и т.д. Единственная разница — количество сообщений AI-сотрудника в месяц:\n\n• Starter ($20/мес) — 200 сообщений\n• Pro ($45/мес) — 1 000 сообщений\n• Business ($95/мес) — 3 000 сообщений\n• Enterprise ($180/мес) — безлимит\n\nПри оплате за год — скидка 20%.",
          en: "All plans include the same features — AI employee, CRM, broadcasts, automations, analytics, etc. The only difference is the number of AI messages per month:\n\n• Starter ($20/mo) — 200 messages\n• Pro ($45/mo) — 1,000 messages\n• Business ($95/mo) — 3,000 messages\n• Enterprise ($180/mo) — unlimited\n\nYearly billing saves 20%.",
          uz: "Barcha tariflar bir xil funksiyalar to'plamini o'z ichiga oladi. Yagona farq — oyiga AI xabarlar soni:\n\n• Starter ($20/oy) — 200 ta xabar\n• Pro ($45/oy) — 1 000 ta xabar\n• Business ($95/oy) — 3 000 ta xabar\n• Enterprise ($180/oy) — cheksiz\n\nYillik to'lovda 20% chegirma.",
          kz: "Барлық тарифтер бірдей функциялар жиынтығын қамтиды. Жалғыз айырмашылық — айына AI хабарлар саны:\n\n• Starter ($20/ай) — 200 хабар\n• Pro ($45/ай) — 1 000 хабар\n• Business ($95/ай) — 3 000 хабар\n• Enterprise ($180/ай) — шексіз\n\nЖылдық төлемде 20% жеңілдік.",
        },
      },
      {
        id: "which-plan",
        question: {
          ru: "Какой план мне выбрать?",
          en: "Which plan should I choose?",
          uz: "Qaysi tarifni tanlashim kerak?",
          kz: "Қай тарифті таңдауым керек?",
        },
        answer: {
          ru: "Ориентируйтесь на количество клиентов в месяц. Один клиент в среднем отправляет 3-8 сообщений (вопросы, запись, подтверждение):\n\n• До 50 клиентов/мес → Starter (200 сообщений)\n• 50-200 клиентов/мес → Pro (1 000 сообщений)\n• 200-500 клиентов/мес → Business (3 000 сообщений)\n• Более 500 клиентов/мес → Enterprise (безлимит)\n\nНачните с пробного периода (14 дней бесплатно, 100 сообщений) — посмотрите реальный расход и выберите подходящий план.",
          en: "Base your choice on monthly client count. One client typically sends 3-8 messages (questions, booking, confirmation):\n\n• Up to 50 clients/mo → Starter (200 messages)\n• 50-200 clients/mo → Pro (1,000 messages)\n• 200-500 clients/mo → Business (3,000 messages)\n• 500+ clients/mo → Enterprise (unlimited)\n\nStart with the free trial (14 days, 100 messages) — see your actual usage and choose the right plan.",
          uz: "Oylik mijozlar soniga qarab tanlang. Bitta mijoz o'rtacha 3-8 ta xabar yuboradi:\n\n• 50 gacha mijoz/oy → Starter (200 ta xabar)\n• 50-200 mijoz/oy → Pro (1 000 ta xabar)\n• 200-500 mijoz/oy → Business (3 000 ta xabar)\n• 500+ mijoz/oy → Enterprise (cheksiz)\n\nSinov muddatidan boshlang (14 kun bepul, 100 ta xabar).",
          kz: "Айлық клиенттер санына қарай таңдаңыз. Бір клиент орташа 3-8 хабар жібереді:\n\n• 50-ге дейін клиент/ай → Starter (200 хабар)\n• 50-200 клиент/ай → Pro (1 000 хабар)\n• 200-500 клиент/ай → Business (3 000 хабар)\n• 500+ клиент/ай → Enterprise (шексіз)\n\nСынақ кезеңінен бастаңыз (14 күн тегін, 100 хабар).",
        },
      },
      {
        id: "messages-run-out",
        question: {
          ru: "Что произойдёт, если закончатся сообщения?",
          en: "What happens when messages run out?",
          uz: "Xabarlar tugasa nima bo'ladi?",
          kz: "Хабарлар таусылса не болады?",
        },
        answer: {
          ru: "AI-сотрудник приостановит работу до начала нового месяца или пока вы не докупите пакет сообщений. Докупить можно в любой момент:\n\n• +100 сообщений — $5\n• +500 сообщений — $20\n• +1 000 сообщений — $35\n\nВы получите предупреждение, когда останется менее 50 сообщений.",
          en: "The AI employee will pause until the new month starts or until you purchase a message pack. You can buy extra messages anytime:\n\n• +100 messages — $5\n• +500 messages — $20\n• +1,000 messages — $35\n\nYou'll get a warning when fewer than 50 messages remain.",
          uz: "AI xodim yangi oy boshlanguncha yoki siz xabar paketi sotib olguncha to'xtaydi. Qo'shimcha xabarlarni istalgan vaqtda sotib olishingiz mumkin:\n\n• +100 ta xabar — $5\n• +500 ta xabar — $20\n• +1 000 ta xabar — $35",
          kz: "AI қызметкер жаңа ай басталғанша немесе хабар пакеті сатып алғанша тоқтайды. Қосымша хабарларды кез келген уақытта сатып алуға болады:\n\n• +100 хабар — $5\n• +500 хабар — $20\n• +1 000 хабар — $35",
        },
      },
      {
        id: "yearly-discount",
        question: {
          ru: "Какая скидка при годовой оплате?",
          en: "What's the yearly billing discount?",
          uz: "Yillik to'lovda qanday chegirma bor?",
          kz: "Жылдық төлемде қандай жеңілдік бар?",
        },
        answer: {
          ru: "При оплате за год вы экономите 20%:\n\n• Starter: $20/мес → $192/год (экономия $48)\n• Pro: $45/мес → $432/год (экономия $108)\n• Business: $95/мес → $912/год (экономия $228)\n• Enterprise: $180/мес → $1 730/год (экономия $430)",
          en: "Yearly billing saves you 20%:\n\n• Starter: $20/mo → $192/year (save $48)\n• Pro: $45/mo → $432/year (save $108)\n• Business: $95/mo → $912/year (save $228)\n• Enterprise: $180/mo → $1,730/year (save $430)",
          uz: "Yillik to'lovda 20% tejaysiz:\n\n• Starter: $20/oy → $192/yil ($48 tejash)\n• Pro: $45/oy → $432/yil ($108 tejash)\n• Business: $95/oy → $912/yil ($228 tejash)\n• Enterprise: $180/oy → $1 730/yil ($430 tejash)",
          kz: "Жылдық төлемде 20% үнемдейсіз:\n\n• Starter: $20/ай → $192/жыл ($48 үнемдеу)\n• Pro: $45/ай → $432/жыл ($108 үнемдеу)\n• Business: $95/ай → $912/жыл ($228 үнемдеу)\n• Enterprise: $180/ай → $1 730/жыл ($430 үнемдеу)",
        },
      },
      {
        id: "what-counts-as-message",
        question: {
          ru: "Что считается сообщением?",
          en: "What counts as a message?",
          uz: "Nima xabar hisoblanadi?",
          kz: "Не хабар болып саналады?",
        },
        answer: {
          ru: "Каждое сообщение, которое AI-сотрудник отправляет клиенту, считается за одно сообщение. Входящие сообщения от клиентов не считаются. Автоматические напоминания и рассылки также учитываются в лимите.",
          en: "Each message sent by the AI employee to a client counts as one message. Incoming messages from clients don't count. Automatic reminders and broadcasts also count toward the limit.",
          uz: "AI xodimning mijozga yuborgan har bir xabari bitta xabar sifatida hisoblanadi. Mijozlardan kelgan xabarlar hisoblanmaydi. Avtomatik eslatmalar va xabarlar ham limitga kiritiladi.",
          kz: "AI қызметкердің клиентке жіберген әрбір хабары бір хабар ретінде есептеледі. Клиенттерден келген хабарлар есептелмейді. Автоматты еске салулар мен хабарламалар да лимитке кіреді.",
        },
      },
    ],
  },

  // ==================== TRIAL ====================
  {
    id: "trial",
    icon: "Gift",
    title: {
      ru: "Пробный период",
      en: "Free Trial",
      uz: "Sinov muddati",
      kz: "Сынақ кезеңі",
    },
    questions: [
      {
        id: "trial-details",
        question: {
          ru: "Что включено в пробный период?",
          en: "What's included in the free trial?",
          uz: "Sinov muddatiga nima kiradi?",
          kz: "Сынақ кезеңіне не кіреді?",
        },
        answer: {
          ru: "14 дней бесплатного доступа ко всем функциям платформы + 100 сообщений AI-сотрудника. Не нужна кредитная карта. Вы можете настроить AI-сотрудника, подключить Telegram-бот, добавить услуги, протестировать все автоматизации.",
          en: "14 days of free access to all platform features + 100 AI messages. No credit card required. You can set up the AI employee, connect a Telegram bot, add services, and test all automations.",
          uz: "Platformaning barcha funksiyalariga 14 kunlik bepul kirish + 100 ta AI xabar. Kredit karta kerak emas. AI xodimni sozlash, Telegram-botni ulash, xizmatlarni qo'shish va barcha avtomatizatsiyalarni sinab ko'rishingiz mumkin.",
          kz: "Платформаның барлық функцияларына 14 күндік тегін қол жетімділік + 100 AI хабар. Несие картасы қажет емес. AI қызметкерді баптау, Telegram-ботты қосу, қызметтерді қосу мүмкін.",
        },
      },
      {
        id: "after-trial",
        question: {
          ru: "Что будет после окончания пробного периода?",
          en: "What happens after the trial ends?",
          uz: "Sinov muddati tugagandan keyin nima bo'ladi?",
          kz: "Сынақ кезеңі аяқталғаннан кейін не болады?",
        },
        answer: {
          ru: "После 14 дней AI-сотрудник приостановит работу. Все ваши данные сохранятся — клиенты, настройки, услуги. Чтобы продолжить, выберите любой платный план. Вам не нужно будет настраивать всё заново.",
          en: "After 14 days, the AI employee will pause. All your data is preserved — clients, settings, services. To continue, choose any paid plan. You won't need to set up everything again.",
          uz: "14 kundan so'ng AI xodim to'xtaydi. Barcha ma'lumotlaringiz saqlanadi — mijozlar, sozlamalar, xizmatlar. Davom ettirish uchun istalgan pullik tarifni tanlang. Hamma narsani qaytadan sozlashingiz shart emas.",
          kz: "14 күннен кейін AI қызметкер тоқтайды. Барлық деректеріңіз сақталады — клиенттер, баптаулар, қызметтер. Жалғастыру үшін кез келген ақылы тарифті таңдаңыз.",
        },
      },
      {
        id: "trial-no-card",
        question: {
          ru: "Нужна ли привязка карты для пробного периода?",
          en: "Do I need a credit card for the trial?",
          uz: "Sinov muddati uchun karta kerakmi?",
          kz: "Сынақ кезеңі үшін карта керек пе?",
        },
        answer: {
          ru: "Нет! Для пробного периода не нужна кредитная карта. Просто зарегистрируйтесь и начните пользоваться. Оплата потребуется только когда вы решите перейти на платный план.",
          en: "No! No credit card is needed for the trial. Just sign up and start using it. Payment is only required when you decide to switch to a paid plan.",
          uz: "Yo'q! Sinov muddati uchun kredit karta kerak emas. Shunchaki ro'yxatdan o'ting va foydalanishni boshlang. To'lov faqat pullik tarifga o'tishga qaror qilganingizda talab qilinadi.",
          kz: "Жоқ! Сынақ кезеңі үшін несие картасы қажет емес. Жай тіркеліп, пайдалана бастаңыз. Төлем тек ақылы тарифке ауысуға шешім қабылдағанда талап етіледі.",
        },
      },
    ],
  },

  // ==================== SETUP ====================
  {
    id: "setup",
    icon: "Settings",
    title: {
      ru: "Настройка",
      en: "Setup",
      uz: "Sozlash",
      kz: "Баптау",
    },
    questions: [
      {
        id: "setup-time",
        question: {
          ru: "Сколько времени занимает настройка?",
          en: "How long does setup take?",
          uz: "Sozlash qancha vaqt oladi?",
          kz: "Баптау қанша уақыт алады?",
        },
        answer: {
          ru: "Базовая настройка занимает 10-15 минут: регистрация, создание Telegram-бота, добавление услуг. Для максимальной эффективности рекомендуем потратить 30-60 минут на заполнение базы знаний (FAQ, загрузка документов).",
          en: "Basic setup takes 10-15 minutes: registration, creating a Telegram bot, adding services. For maximum efficiency, we recommend spending 30-60 minutes filling the knowledge base (FAQ, document uploads).",
          uz: "Asosiy sozlash 10-15 daqiqa oladi: ro'yxatdan o'tish, Telegram-bot yaratish, xizmatlarni qo'shish. Maksimal samaradorlik uchun bilimlar bazasini to'ldirish (FAQ, hujjatlar yuklash) uchun 30-60 daqiqa sarflashni tavsiya etamiz.",
          kz: "Негізгі баптау 10-15 минут алады: тіркелу, Telegram-бот жасау, қызметтерді қосу. Максималды тиімділік үшін білім базасын толтыруға 30-60 минут жұмсауды ұсынамыз.",
        },
      },
      {
        id: "setup-difficulty",
        question: {
          ru: "Нужны ли технические знания?",
          en: "Do I need technical skills?",
          uz: "Texnik bilim kerakmi?",
          kz: "Техникалық білім қажет пе?",
        },
        answer: {
          ru: "Нет. Staffix создан для владельцев бизнеса, а не для программистов. Всё делается через удобный интерфейс: добавляете услуги, пишете ответы на частые вопросы, загружаете прайс-лист — и AI-сотрудник готов к работе.",
          en: "No. Staffix is built for business owners, not programmers. Everything is done through a user-friendly interface: add services, write FAQ answers, upload price lists — and the AI employee is ready to work.",
          uz: "Yo'q. Staffix biznes egalari uchun yaratilgan, dasturchilar uchun emas. Hamma narsa qulay interfeys orqali amalga oshiriladi: xizmatlarni qo'shing, FAQ javoblarini yozing, narxlar ro'yxatini yuklang — va AI xodim ishlashga tayyor.",
          kz: "Жоқ. Staffix бизнес иелері үшін жасалған, бағдарламашылар үшін емес. Барлығы ыңғайлы интерфейс арқылы жасалады: қызметтерді қосыңыз, FAQ жауаптарын жазыңыз — AI қызметкер жұмысқа дайын.",
        },
      },
      {
        id: "telegram-bot-creation",
        question: {
          ru: "Как создать Telegram-бота?",
          en: "How do I create a Telegram bot?",
          uz: "Telegram-botni qanday yarataman?",
          kz: "Telegram-ботты қалай жасаймын?",
        },
        answer: {
          ru: "Это займёт 2 минуты:\n1. Откройте @BotFather в Telegram\n2. Отправьте команду /newbot\n3. Придумайте имя бота (например: «Салон Красоты Assistant»)\n4. Придумайте username (например: salon_beauty_bot)\n5. Скопируйте полученный токен\n6. Вставьте токен в настройках Staffix\n\nГотово! Бот подключён.",
          en: "It takes 2 minutes:\n1. Open @BotFather in Telegram\n2. Send the /newbot command\n3. Choose a bot name (e.g., \"Beauty Salon Assistant\")\n4. Choose a username (e.g., salon_beauty_bot)\n5. Copy the received token\n6. Paste the token in Staffix settings\n\nDone! Bot is connected.",
          uz: "Bu 2 daqiqa oladi:\n1. Telegram'da @BotFather ni oching\n2. /newbot buyrug'ini yuboring\n3. Bot nomini o'ylab toping\n4. Username tanlang\n5. Olingan tokenni nusxalang\n6. Tokenni Staffix sozlamalariga joylashtiring\n\nTayyor! Bot ulangan.",
          kz: "Бұл 2 минут алады:\n1. Telegram-да @BotFather ашыңыз\n2. /newbot командасын жіберіңіз\n3. Бот атын ойлап табыңыз\n4. Username таңдаңыз\n5. Алынған токенді көшіріңіз\n6. Токенді Staffix баптауларына қойыңыз\n\nДайын! Бот қосылды.",
        },
      },
      {
        id: "what-data-to-prepare",
        question: {
          ru: "Какие данные подготовить заранее?",
          en: "What data should I prepare?",
          uz: "Qanday ma'lumotlarni oldindan tayyorlash kerak?",
          kz: "Қандай деректерді алдын ала дайындау керек?",
        },
        answer: {
          ru: "Для быстрой настройки подготовьте:\n\n• Список услуг с ценами и длительностью\n• Часы работы\n• Адрес (если есть физическая точка)\n• Ответы на частые вопросы клиентов\n• Прайс-лист (PDF или Word — можно загрузить)\n• Фото сотрудников (необязательно)\n\nЧем больше информации — тем умнее будет ваш AI-сотрудник.",
          en: "For quick setup, prepare:\n\n• Service list with prices and durations\n• Working hours\n• Address (if you have a physical location)\n• Answers to common client questions\n• Price list (PDF or Word — can be uploaded)\n• Staff photos (optional)\n\nThe more information — the smarter your AI employee will be.",
          uz: "Tez sozlash uchun tayyorlang:\n\n• Narxlar va davomiylik bilan xizmatlar ro'yxati\n• Ish soatlari\n• Manzil (agar jismoniy joy bo'lsa)\n• Mijozlarning tez-tez beriladigan savollariga javoblar\n• Narxlar ro'yxati (PDF yoki Word)\n• Xodimlar suratlari (ixtiyoriy)",
          kz: "Жылдам баптау үшін дайындаңыз:\n\n• Бағалар мен ұзақтығы бар қызметтер тізімі\n• Жұмыс уақыты\n• Мекен-жай\n• Клиенттердің жиі қойылатын сұрақтарына жауаптар\n• Прайс-парақ (PDF немесе Word)\n• Қызметкерлер фотосуреттері (міндетті емес)",
        },
      },
    ],
  },

  // ==================== AI CAPABILITIES ====================
  {
    id: "ai",
    icon: "Brain",
    title: {
      ru: "Возможности AI",
      en: "AI Capabilities",
      uz: "AI imkoniyatlari",
      kz: "AI мүмкіндіктері",
    },
    questions: [
      {
        id: "what-ai-can-do",
        question: {
          ru: "Что умеет AI-сотрудник?",
          en: "What can the AI employee do?",
          uz: "AI xodim nimalarni qila oladi?",
          kz: "AI қызметкер нелерді істей алады?",
        },
        answer: {
          ru: "AI-сотрудник умеет:\n• Отвечать на вопросы о ваших услугах, ценах, расположении\n• Записывать клиентов на приём (с проверкой свободного времени)\n• Отменять и переносить записи\n• Отправлять напоминания о визите\n• Просить оставить отзыв после визита\n• Возвращать неактивных клиентов со скидками\n• Запоминать каждого клиента и персонализировать общение\n• Общаться на языке клиента",
          en: "The AI employee can:\n• Answer questions about your services, prices, location\n• Book appointments (with availability checking)\n• Cancel and reschedule bookings\n• Send visit reminders\n• Request reviews after visits\n• Win back inactive clients with discounts\n• Remember each client and personalize communication\n• Communicate in the client's language",
          uz: "AI xodim quyidagilarni qila oladi:\n• Xizmatlar, narxlar, manzil haqida savollarga javob berish\n• Mijozlarni uchrashuvga yozish\n• Yozuvlarni bekor qilish va ko'chirish\n• Tashrif haqida eslatmalar yuborish\n• Tashrifdan so'ng sharh so'rash\n• Nofaol mijozlarni chegirmalar bilan qaytarish\n• Har bir mijozni eslab qolish",
          kz: "AI қызметкер:\n• Қызметтер, бағалар, орналасу туралы сұрақтарға жауап бере алады\n• Клиенттерді қабылдауға жаза алады\n• Жазбаларды бас тарту және ауыстыра алады\n• Бару туралы еске салулар жібере алады\n• Барғаннан кейін пікір сұрай алады\n• Белсенді емес клиенттерді жеңілдіктермен қайтара алады",
        },
      },
      {
        id: "ai-limitations",
        question: {
          ru: "Что AI-сотрудник НЕ может?",
          en: "What can't the AI employee do?",
          uz: "AI xodim nimalarni qila olmaydi?",
          kz: "AI қызметкер нелерді істей алмайды?",
        },
        answer: {
          ru: "AI-сотрудник не может:\n• Принимать оплату (клиент платит при визите или через внешние сервисы)\n• Выполнять физические услуги\n• Принимать решения, требующие медицинской или юридической квалификации\n• Отвечать на вопросы, не связанные с вашим бизнесом\n\nЕсли AI не может помочь — он предложит связаться с администратором.",
          en: "The AI employee cannot:\n• Accept payments (clients pay at visit or through external services)\n• Perform physical services\n• Make decisions requiring medical or legal qualifications\n• Answer questions unrelated to your business\n\nIf the AI can't help — it will suggest contacting the administrator.",
          uz: "AI xodim quyidagilarni qila olmaydi:\n• To'lov qabul qilish\n• Jismoniy xizmatlarni bajarish\n• Tibbiy yoki huquqiy malaka talab qiladigan qarorlar qabul qilish\n• Biznesingiz bilan bog'liq bo'lmagan savollarga javob berish",
          kz: "AI қызметкер:\n• Төлем қабылдай алмайды\n• Физикалық қызметтерді орындай алмайды\n• Медициналық немесе заңгерлік біліктілік талап ететін шешімдер қабылдай алмайды\n• Бизнесіңізбен байланысты емес сұрақтарға жауап бере алмайды",
        },
      },
      {
        id: "ai-training",
        question: {
          ru: "Как обучить AI-сотрудника?",
          en: "How do I train the AI employee?",
          uz: "AI xodimni qanday o'rgataman?",
          kz: "AI қызметкерді қалай үйретемін?",
        },
        answer: {
          ru: "Три способа обучения:\n\n1. **Добавьте услуги** — AI будет знать ваш каталог с ценами\n2. **Создайте FAQ** — напишите вопросы и ответы, которые часто задают клиенты\n3. **Загрузите документы** — прайс-листы, правила, описания услуг (PDF, Word, Excel, TXT)\n\nСовет: чем подробнее информация, тем лучше AI отвечает. Добавьте описания процедур, противопоказания, рекомендации после визита.",
          en: "Three ways to train:\n\n1. **Add services** — AI will know your catalog with prices\n2. **Create FAQ** — write questions and answers your clients often ask\n3. **Upload documents** — price lists, policies, service descriptions (PDF, Word, Excel, TXT)\n\nTip: the more detailed the information, the better AI responds. Add procedure descriptions, contraindications, post-visit recommendations.",
          uz: "O'rgatishning uch usuli:\n\n1. **Xizmatlarni qo'shing** — AI narxlar bilan katalogingizni biladi\n2. **FAQ yarating** — mijozlar ko'p so'raydigan savollar va javoblarni yozing\n3. **Hujjatlarni yuklang** — narxlar, qoidalar, xizmat tavsiflari (PDF, Word, Excel, TXT)",
          kz: "Үйретудің үш жолы:\n\n1. **Қызметтерді қосыңыз** — AI бағалармен каталогыңызды біледі\n2. **FAQ жасаңыз** — клиенттер жиі сұрайтын сұрақтар мен жауаптарды жазыңыз\n3. **Құжаттарды жүктеңіз** — прайс-парақтар, ережелер (PDF, Word, Excel, TXT)",
        },
      },
      {
        id: "ai-personality",
        question: {
          ru: "Можно ли настроить характер AI?",
          en: "Can I customize the AI personality?",
          uz: "AI xarakterini sozlash mumkinmi?",
          kz: "AI мінезін баптауға бола ма?",
        },
        answer: {
          ru: "Да! Вы можете:\n• Выбрать стиль общения: дружелюбный, профессиональный или неформальный\n• Написать своё приветственное сообщение\n• Добавить специальные правила (например: «Всегда упоминай акцию понедельника», «Не обсуждай конкурентов»)\n• Выбрать шаблон из 6 готовых (салон, клиника, ресторан, фитнес, автосервис, магазин)",
          en: "Yes! You can:\n• Choose communication style: friendly, professional, or casual\n• Write a custom welcome message\n• Add special rules (e.g., \"Always mention Monday's promotion\", \"Don't discuss competitors\")\n• Choose from 6 ready-made templates (salon, clinic, restaurant, fitness, auto service, shop)",
          uz: "Ha! Siz quyidagilarni qilishingiz mumkin:\n• Muloqot uslubini tanlang: do'stona, professional yoki norasmiy\n• O'z salomlash xabaringizni yozing\n• Maxsus qoidalar qo'shing\n• 6 ta tayyor shablondan tanlang",
          kz: "Иә! Сіз:\n• Қарым-қатынас стилін таңдай аласыз: достық, кәсіби немесе бейресми\n• Өзіңіздің сәлемдесу хабарыңызды жаза аласыз\n• Арнайы ережелер қоса аласыз\n• 6 дайын шаблоннан таңдай аласыз",
        },
      },
    ],
  },

  // ==================== BILLING ====================
  {
    id: "billing",
    icon: "Wallet",
    title: {
      ru: "Оплата",
      en: "Billing",
      uz: "To'lov",
      kz: "Төлем",
    },
    questions: [
      {
        id: "payment-methods",
        question: {
          ru: "Какие способы оплаты принимаются?",
          en: "What payment methods are accepted?",
          uz: "Qanday to'lov usullari qabul qilinadi?",
          kz: "Қандай төлем әдістері қабылданады?",
        },
        answer: {
          ru: "Оплата проходит через PayPro Global — международный платёжный процессор. Принимаются: банковские карты (Visa, Mastercard), PayPal и другие международные методы оплаты. Оплата безопасна и защищена.",
          en: "Payment is processed through PayPro Global — an international payment processor. Accepted: bank cards (Visa, Mastercard), PayPal, and other international payment methods. Payment is secure and protected.",
          uz: "To'lov PayPro Global — xalqaro to'lov protsessori orqali amalga oshiriladi. Qabul qilinadi: bank kartalari (Visa, Mastercard), PayPal va boshqa xalqaro to'lov usullari.",
          kz: "Төлем PayPro Global — халықаралық төлем процессоры арқылы жүргізіледі. Қабылданады: банк карталары (Visa, Mastercard), PayPal және басқа халықаралық төлем әдістері.",
        },
      },
      {
        id: "cancellation",
        question: {
          ru: "Можно ли отменить подписку?",
          en: "Can I cancel my subscription?",
          uz: "Obunani bekor qilish mumkinmi?",
          kz: "Жазылымды бас тартуға бола ма?",
        },
        answer: {
          ru: "Да, подписку можно отменить в любой момент из настроек аккаунта. После отмены вы продолжите пользоваться до конца оплаченного периода. Автоматическое продление не произойдёт. Все ваши данные сохранятся — вы сможете вернуться в любое время.",
          en: "Yes, you can cancel anytime from account settings. After cancellation, you'll continue using the service until the end of the paid period. Auto-renewal won't happen. All your data is preserved — you can come back anytime.",
          uz: "Ha, obunani istalgan vaqtda akkaunt sozlamalaridan bekor qilishingiz mumkin. Bekor qilgandan so'ng to'langan muddat oxirigacha foydalanishni davom ettirasiz.",
          kz: "Иә, жазылымды кез келген уақытта аккаунт баптауларынан бас тартуға болады. Бас тартқаннан кейін төленген кезеңнің соңына дейін пайдалана аласыз.",
        },
      },
    ],
  },

  // ==================== WHATSAPP ====================
  {
    id: "whatsapp",
    icon: "MessageCircle",
    title: {
      ru: "Подключение WhatsApp",
      en: "WhatsApp Setup",
      uz: "WhatsApp ulash",
      kz: "WhatsApp қосу",
    },
    questions: [
      {
        id: "whatsapp-what-need",
        question: {
          ru: "Что нужно для подключения WhatsApp?",
          en: "What do I need to connect WhatsApp?",
          uz: "WhatsApp ulash uchun nima kerak?",
          kz: "WhatsApp қосу үшін не керек?",
        },
        answer: {
          ru: "Для подключения WhatsApp понадобится:\n\n• Отдельная симкарта (любой оператор), которая ещё не привязана к WhatsApp\n• Телефон для получения SMS-кода при регистрации\n• Аккаунт в Facebook (для Meta Developers)\n\nНомер будет работать как WhatsApp Business API — клиенты пишут вам, AI отвечает автоматически.",
          en: "To connect WhatsApp, you'll need:\n\n• A separate SIM card (any carrier) not yet linked to WhatsApp\n• A phone to receive the SMS verification code\n• A Facebook account (for Meta Developers)\n\nThe number will work as WhatsApp Business API — clients write to you, AI replies automatically.",
          uz: "WhatsApp ulash uchun kerak:\n\n• Alohida SIM-karta (istalgan operator), hali WhatsApp-ga bog'lanmagan\n• SMS-kod olish uchun telefon\n• Facebook akkaunti (Meta Developers uchun)\n\nRaqam WhatsApp Business API sifatida ishlaydi — mijozlar sizga yozadi, AI avtomatik javob beradi.",
          kz: "WhatsApp қосу үшін қажет:\n\n• Бөлек SIM-карта (кез келген оператор), әлі WhatsApp-қа байланбаған\n• SMS-код алу үшін телефон\n• Facebook аккаунті (Meta Developers үшін)\n\nНөмір WhatsApp Business API ретінде жұмыс істейді — клиенттер сізге жазады, AI автоматты жауап береді.",
        },
      },
      {
        id: "whatsapp-step-by-step",
        question: {
          ru: "Пошаговая инструкция: как подключить WhatsApp к боту?",
          en: "Step-by-step: how to connect WhatsApp to the bot?",
          uz: "Bosqichma-bosqich: WhatsApp-ni botga qanday ulash mumkin?",
          kz: "Қадамдық нұсқаулық: WhatsApp-ты ботқа қалай қосуға болады?",
        },
        answer: {
          ru: "**Шаг 1. Купите отдельную симкарту**\nВозьмите новую симку любого оператора. Важно: этот номер не должен быть зарегистрирован в WhatsApp.\n\n**Шаг 2. Зарегистрируйтесь в WhatsApp Business**\nСкачайте приложение WhatsApp Business, зарегистрируйте на нём эту симку — получите SMS, введите код.\n\n**Шаг 3. Откройте Meta Developers**\nЗайдите на developers.facebook.com → войдите через Facebook → выберите ваше приложение (или создайте новое) → перейдите в раздел WhatsApp → API Setup.\n\n**Шаг 4. Скопируйте Phone Number ID и Access Token**\nНа странице API Setup увидите поле Phone Number ID — скопируйте его. Временный Access Token там же — скопируйте (или создайте постоянный через System Users).\n\n**Шаг 5. Внесите данные в Staffix**\nDashboard → Бот → раздел WhatsApp → вставьте Phone Number ID и Access Token → придумайте Verify Token (любое слово, например: mybusiness2025) → нажмите Сохранить → скопируйте Webhook URL.\n\n**Шаг 6. Настройте Webhook в Meta**\nMeta Developers → WhatsApp → Configuration → вставьте Webhook URL и Verify Token → выберите событие messages → нажмите Verify and Save.\n\n**Шаг 7. Активируйте**\nВернитесь в Staffix → Бот → WhatsApp → включите тоггл «Активировать» → Сохранить.\n\nГотово! Теперь клиенты пишут на ваш WhatsApp, а AI отвечает автоматически. Если что-то не получается — напишите в поддержку, поможем за 15 минут.",
          en: "**Step 1. Get a separate SIM card**\nGet a new SIM from any carrier. Important: the number must not be registered in WhatsApp.\n\n**Step 2. Register in WhatsApp Business**\nDownload WhatsApp Business app, register this SIM — receive SMS, enter the code.\n\n**Step 3. Open Meta Developers**\nGo to developers.facebook.com → log in via Facebook → select your app (or create one) → go to WhatsApp → API Setup.\n\n**Step 4. Copy Phone Number ID and Access Token**\nOn the API Setup page, find Phone Number ID — copy it. Temporary Access Token is there too — copy it (or create a permanent one via System Users).\n\n**Step 5. Enter data in Staffix**\nDashboard → Bot → WhatsApp section → paste Phone Number ID and Access Token → invent a Verify Token (any word, e.g.: mybusiness2025) → click Save → copy the Webhook URL.\n\n**Step 6. Set up Webhook in Meta**\nMeta Developers → WhatsApp → Configuration → paste Webhook URL and Verify Token → select messages event → click Verify and Save.\n\n**Step 7. Activate**\nReturn to Staffix → Bot → WhatsApp → enable the Activate toggle → Save.\n\nDone! Clients write to your WhatsApp, AI replies automatically. If you need help — contact support, we'll help in 15 minutes.",
          uz: "**1-qadam. Alohida SIM-karta oling**\nIstalgan operatordan yangi SIM-karta oling. Muhim: bu raqam WhatsApp-da ro'yxatdan o'tmagan bo'lishi kerak.\n\n**2-qadam. WhatsApp Business-da ro'yxatdan o'ting**\nWhatsApp Business ilovasini yuklab oling, ushbu SIM-kartani ro'yxatdan o'tkazing — SMS oling, kodni kiriting.\n\n**3-qadam. Meta Developers-ni oching**\ndevelopers.facebook.com ga kiring → Facebook orqali kiring → ilovangizni tanlang → WhatsApp → API Setup ga o'ting.\n\n**4-qadam. Phone Number ID va Access Token-ni nusxalang**\nAPI Setup sahifasida Phone Number ID maydonini toping — nusxalang. Vaqtinchalik Access Token ham u yerda — nusxalang.\n\n**5-qadam. Ma'lumotlarni Staffix-ga kiriting**\nDashboard → Bot → WhatsApp bo'limi → Phone Number ID va Access Token-ni joylashtiring → Verify Token o'ylab toping → Saqlash tugmasini bosing → Webhook URL-ni nusxalang.\n\n**6-qadam. Meta-da Webhook-ni sozlang**\nMeta Developers → WhatsApp → Configuration → Webhook URL va Verify Token-ni joylashtiring → messages hodisasini tanlang → Verify and Save.\n\n**7-qadam. Faollashtiring**\nStaffixga qayting → Bot → WhatsApp → Faollashtirish tugmasini yoqing → Saqlash.\n\nTayyor! Endi mijozlar sizning WhatsApp-ingizga yozadi, AI avtomatik javob beradi.",
          kz: "**1-қадам. Бөлек SIM-карта алыңыз**\nКез келген операторда жаңа SIM-карта алыңыз. Маңызды: бұл нөмір WhatsApp-та тіркелмеген болуы керек.\n\n**2-қадам. WhatsApp Business-та тіркеліңіз**\nWhatsApp Business қосымшасын жүктеңіз, осы SIM-картаны тіркеңіз — SMS алыңыз, кодты енгізіңіз.\n\n**3-қадам. Meta Developers-ті ашыңыз**\ndevelopers.facebook.com сайтына кіріңіз → Facebook арқылы кіріңіз → қосымшаңызды таңдаңыз → WhatsApp → API Setup-қа өтіңіз.\n\n**4-қадам. Phone Number ID мен Access Token-ді көшіріңіз**\nAPI Setup бетінде Phone Number ID өрісін табыңыз — көшіріңіз. Уақытша Access Token да сонда — көшіріңіз.\n\n**5-қадам. Деректерді Staffix-ке енгізіңіз**\nDashboard → Бот → WhatsApp бөлімі → Phone Number ID мен Access Token-ді қойыңыз → Verify Token ойлап табыңыз → Сақтау → Webhook URL-ді көшіріңіз.\n\n**6-қадам. Meta-да Webhook орнатыңыз**\nMeta Developers → WhatsApp → Configuration → Webhook URL мен Verify Token-ді қойыңыз → messages оқиғасын таңдаңыз → Verify and Save.\n\n**7-қадам. Белсендіріңіз**\nStaffixке оралыңыз → Бот → WhatsApp → Белсендіру тоглін қосыңыз → Сақтау.\n\nДайын!",
        },
      },
      {
        id: "whatsapp-permanent-token",
        question: {
          ru: "Как создать постоянный Access Token для WhatsApp?",
          en: "How to create a permanent WhatsApp Access Token?",
          uz: "WhatsApp uchun doimiy Access Token qanday yaratiladi?",
          kz: "WhatsApp үшін тұрақты Access Token қалай жасалады?",
        },
        answer: {
          ru: "Временный токен истекает через 24 часа. Для постоянной работы создайте системный токен:\n\n1. Откройте business.facebook.com → Настройки → Системные пользователи\n2. Нажмите «Добавить системного пользователя» → дайте ему роль Admin\n3. Нажмите «Создать токен» → выберите ваше приложение Staffix AI\n4. В разделе разрешений включите: whatsapp_business_messaging + whatsapp_business_management\n5. Нажмите «Создать токен» → скопируйте токен → сохраните в надёжное место\n6. Вставьте этот токен в настройках WhatsApp в Staffix\n\nЭтот токен бессрочный. Если возникнут сложности — напишите в поддержку, поможем пошагово.",
          en: "The temporary token expires after 24 hours. For permanent operation, create a system token:\n\n1. Open business.facebook.com → Settings → System Users\n2. Click Add System User → give it Admin role\n3. Click Generate Token → select your Staffix AI app\n4. In permissions, enable: whatsapp_business_messaging + whatsapp_business_management\n5. Click Generate Token → copy the token → save it securely\n6. Paste this token in WhatsApp settings in Staffix\n\nThis token never expires. If you need help — contact support.",
          uz: "Vaqtinchalik token 24 soatdan keyin tugaydi. Doimiy ishlash uchun tizim tokenini yarating:\n\n1. business.facebook.com → Sozlamalar → Tizim foydalanuvchilari\n2. Tizim foydalanuvchisini qo'shish → Admin roli bering\n3. Token yaratish → Staffix AI ilovangizni tanlang\n4. Ruxsatlar: whatsapp_business_messaging + whatsapp_business_management\n5. Token yaratish → nusxalang → xavfsiz joyga saqlang\n6. Bu tokenni Staffix WhatsApp sozlamalariga joylashtiring\n\nBu token muddatsiz.",
          kz: "Уақытша токен 24 сағаттан кейін аяқталады. Тұрақты жұмыс үшін жүйелік токен жасаңыз:\n\n1. business.facebook.com → Параметрлер → Жүйелік пайдаланушылар\n2. Жүйелік пайдаланушы қосу → Admin рөлін беріңіз\n3. Токен жасау → Staffix AI қосымшаңызды таңдаңыз\n4. Рұқсаттар: whatsapp_business_messaging + whatsapp_business_management\n5. Токен жасау → көшіріңіз → сенімді жерге сақтаңыз\n6. Бұл токенді Staffix WhatsApp баптауларына қойыңыз\n\nБұл токен мерзімсіз.",
        },
      },
      {
        id: "whatsapp-not-working",
        question: {
          ru: "WhatsApp подключён, но бот не отвечает. Что делать?",
          en: "WhatsApp is connected, but the bot doesn't respond. What to do?",
          uz: "WhatsApp ulangan, lekin bot javob bermayapti. Nima qilish kerak?",
          kz: "WhatsApp қосылған, бірақ бот жауап бермейді. Не істеу керек?",
        },
        answer: {
          ru: "Проверьте по чек-листу:\n\n✅ В разделе WhatsApp включён тоггл «Активировать»\n✅ Phone Number ID — числовой, без пробелов (16-17 цифр)\n✅ Access Token начинается с EAAA... и не истёк (или используйте постоянный)\n✅ Verify Token в Staffix совпадает с тем, что вы вводили в Meta Developers\n✅ В Meta Developers → WhatsApp → Configuration → Webhook активен (зелёная галочка)\n✅ В подписках Webhook выбрано событие messages\n\nЕсли всё в порядке — напишите в поддержку, приложите скриншот страницы Configuration в Meta Developers. Разберёмся за 15 минут.",
          en: "Check this list:\n\n✅ In WhatsApp section, the Activate toggle is on\n✅ Phone Number ID is numeric, no spaces (16-17 digits)\n✅ Access Token starts with EAAA... and hasn't expired (or use a permanent one)\n✅ Verify Token in Staffix matches what you entered in Meta Developers\n✅ In Meta Developers → WhatsApp → Configuration → Webhook is active (green checkmark)\n✅ Webhook subscriptions include the messages event\n\nIf everything looks fine — contact support with a screenshot of the Configuration page. We'll resolve it in 15 minutes.",
          uz: "Tekshirish ro'yxati:\n\n✅ WhatsApp bo'limida Faollashtirish tugmasi yoqilgan\n✅ Phone Number ID raqamli, bo'shliqlarsiz (16-17 raqam)\n✅ Access Token EAAA... bilan boshlanadi va muddati o'tmagan\n✅ Staffixdagi Verify Token Meta Developers-ga kiritilgan bilan mos keladi\n✅ Meta Developers → WhatsApp → Configuration → Webhook faol (yashil belgi)\n✅ Webhook obunalarida messages hodisasi tanlangan\n\nHamma narsa to'g'ri ko'rinsa — qo'llab-quvvatlash xizmatiga yozing.",
          kz: "Тексеру тізімі:\n\n✅ WhatsApp бөлімінде Белсендіру тоглі қосулы\n✅ Phone Number ID сандық, бос орынсыз (16-17 сан)\n✅ Access Token EAAA... басталады және мерзімі өтпеген\n✅ Staffixтегі Verify Token Meta Developers-ке енгізілгенмен сәйкес\n✅ Meta Developers → WhatsApp → Configuration → Webhook белсенді (жасыл белгі)\n✅ Webhook жазылымдарында messages оқиғасы таңдалған\n\nБәрі дұрыс болып көрінсе — қолдауға жазыңыз.",
        },
      },
    ],
  },

  // ==================== SECURITY ====================
  {
    id: "security",
    icon: "Shield",
    title: {
      ru: "Безопасность",
      en: "Security",
      uz: "Xavfsizlik",
      kz: "Қауіпсіздік",
    },
    questions: [
      {
        id: "data-protection",
        question: {
          ru: "Как защищены данные моих клиентов?",
          en: "How is my client data protected?",
          uz: "Mijozlarim ma'lumotlari qanday himoyalangan?",
          kz: "Клиенттерімнің деректері қалай қорғалған?",
        },
        answer: {
          ru: "Мы серьёзно относимся к безопасности данных:\n• Все данные хранятся на защищённых серверах\n• Шифрование при передаче (HTTPS/TLS)\n• Пароли хранятся в зашифрованном виде (bcrypt)\n• Доступ к данным только у владельца аккаунта\n• Регулярные бэкапы базы данных",
          en: "We take data security seriously:\n• All data stored on protected servers\n• Encryption in transit (HTTPS/TLS)\n• Passwords stored encrypted (bcrypt)\n• Data access only for account owner\n• Regular database backups",
          uz: "Biz ma'lumotlar xavfsizligiga jiddiy yondashamiz:\n• Barcha ma'lumotlar himoyalangan serverlarda saqlanadi\n• Uzatishda shifrlash (HTTPS/TLS)\n• Parollar shifrlangan holda saqlanadi (bcrypt)\n• Ma'lumotlarga faqat akkaunt egasi kira oladi",
          kz: "Біз деректер қауіпсіздігіне байыпты қараймыз:\n• Барлық деректер қорғалған серверлерде сақталады\n• Тасымалдау кезінде шифрлау (HTTPS/TLS)\n• Парольдер шифрланған түрде сақталады (bcrypt)\n• Деректерге тек аккаунт иесі кіре алады",
        },
      },
      {
        id: "gdpr",
        question: {
          ru: "Соответствует ли Staffix GDPR?",
          en: "Is Staffix GDPR compliant?",
          uz: "Staffix GDPR ga mosmi?",
          kz: "Staffix GDPR-ге сәйкес пе?",
        },
        answer: {
          ru: "Да. Staffix соблюдает требования GDPR (Общий регламент защиты данных ЕС). Мы предоставляем DPA (Data Processing Agreement) — соглашение об обработке данных. Подробности доступны на странице /dpa.",
          en: "Yes. Staffix complies with GDPR (EU General Data Protection Regulation). We provide a DPA (Data Processing Agreement). Details are available at /dpa.",
          uz: "Ha. Staffix GDPR (Yevropa Ittifoqining Umumiy Ma'lumotlarni Himoya Qilish Reglamenti) talablariga mos keladi. Biz DPA (Ma'lumotlarni Qayta Ishlash Shartnomasi) taqdim etamiz.",
          kz: "Иә. Staffix GDPR (ЕО Жалпы деректерді қорғау регламенті) талаптарына сәйкес. Біз DPA (Деректерді өңдеу келісімі) ұсынамыз. Толық ақпарат /dpa бетінде.",
        },
      },
    ],
  },
];

// Helper: get all questions flat
export function getAllFaqQuestions(): (FaqItem & { categoryId: string })[] {
  return faqCategories.flatMap((cat) =>
    cat.questions.map((q) => ({ ...q, categoryId: cat.id }))
  );
}
