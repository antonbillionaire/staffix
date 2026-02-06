export type Language = "ru" | "en" | "uz" | "kz";

export const languages: { id: Language; name: string; flag: string }[] = [
  { id: "ru", name: "Русский", flag: "🇷🇺" },
  { id: "en", name: "English", flag: "🇬🇧" },
  { id: "uz", name: "O'zbek", flag: "🇺🇿" },
  { id: "kz", name: "Қазақша", flag: "🇰🇿" },
];

export const translations: Record<Language, Record<string, string>> = {
  ru: {
    // Navigation
    "nav.dashboard": "Главная",
    "nav.aiEmployee": "AI-сотрудник",
    "nav.channels": "Каналы",
    "nav.statistics": "Статистика",
    "nav.services": "Услуги",
    "nav.team": "Команда",
    "nav.knowledge": "База знаний",
    "nav.bookings": "Записи",
    "nav.customers": "Клиенты",
    "nav.broadcasts": "Рассылки",
    "nav.automation": "Автоматизация",
    "nav.messages": "Сообщения",
    "nav.settings": "Настройки",
    "nav.help": "Помощь",
    "nav.logout": "Выйти",

    // Sidebar
    "sidebar.yourBusiness": "Ваш бизнес",
    "sidebar.messages": "Сообщений",
    "sidebar.daysLeft": "Осталось {days} дней",
    "sidebar.choosePlan": "Выбрать тариф",

    // Dashboard
    "dashboard.title": "Панель управления",
    "dashboard.welcome": "Добро пожаловать",
    "dashboard.todayStats": "Статистика за сегодня",
    "dashboard.newMessages": "Новых сообщений",
    "dashboard.newBookings": "Новых записей",
    "dashboard.newCustomers": "Новых клиентов",
    "dashboard.messagesUsed": "Использовано сообщений",

    // Common
    "common.save": "Сохранить",
    "common.cancel": "Отмена",
    "common.delete": "Удалить",
    "common.edit": "Редактировать",
    "common.add": "Добавить",
    "common.search": "Поиск",
    "common.loading": "Загрузка...",
    "common.noData": "Нет данных",
    "common.actions": "Действия",
    "common.status": "Статус",
    "common.date": "Дата",
    "common.name": "Имя",
    "common.phone": "Телефон",
    "common.email": "Email",
    "common.price": "Цена",
    "common.duration": "Длительность",
    "common.minutes": "мин",
    "common.currency": "тг",

    // Warnings
    "warning.lowMessages": "Осталось мало сообщений",
    "warning.messagesAlmostOut": "Сообщения почти закончились!",
    "warning.remaining": "Осталось {count} из {total} сообщений.",
    "warning.upgradePlan": "Обновить тариф",

    // Settings
    "settings.title": "Настройки",
    "settings.profile": "Профиль",
    "settings.business": "Бизнес",
    "settings.notifications": "Уведомления",
    "settings.language": "Язык интерфейса",
    "settings.theme": "Тема",
    "settings.themeDark": "Тёмная",
    "settings.themeLight": "Светлая",

    // Bot
    "bot.title": "AI-сотрудник",
    "bot.status": "Статус бота",
    "bot.active": "Активен",
    "bot.inactive": "Неактивен",
    "bot.connect": "Подключить бота",
    "bot.disconnect": "Отключить",
    "bot.testBot": "Тестировать бота",

    // Services
    "services.title": "Услуги",
    "services.addService": "Добавить услугу",
    "services.serviceName": "Название услуги",
    "services.noServices": "Услуги не добавлены",

    // Staff
    "staff.title": "Команда",
    "staff.addStaff": "Добавить сотрудника",
    "staff.role": "Должность",
    "staff.noStaff": "Сотрудники не добавлены",

    // FAQ
    "faq.title": "База знаний",
    "faq.addFaq": "Добавить вопрос",
    "faq.question": "Вопрос",
    "faq.answer": "Ответ",
    "faq.noFaqs": "Вопросы не добавлены",

    // Bookings
    "bookings.title": "Записи",
    "bookings.addBooking": "Добавить запись",
    "bookings.clientName": "Имя клиента",
    "bookings.service": "Услуга",
    "bookings.staff": "Мастер",
    "bookings.dateTime": "Дата и время",
    "bookings.noBookings": "Записей нет",
    "bookings.pending": "Ожидает",
    "bookings.confirmed": "Подтверждена",
    "bookings.cancelled": "Отменена",
    "bookings.completed": "Выполнена",

    // Customers
    "customers.title": "Клиенты",
    "customers.totalCustomers": "Всего клиентов",
    "customers.activeCustomers": "Активных клиентов",
    "customers.newThisMonth": "Новых в этом месяце",
    "customers.noCustomers": "Клиентов пока нет",

    // Broadcasts
    "broadcasts.title": "Рассылки",
    "broadcasts.newBroadcast": "Новая рассылка",
    "broadcasts.recipients": "Получатели",
    "broadcasts.sent": "Отправлено",
    "broadcasts.draft": "Черновик",

    // Statistics
    "statistics.title": "Статистика",
    "statistics.totalMessages": "Всего сообщений",
    "statistics.totalBookings": "Всего записей",
    "statistics.conversionRate": "Конверсия",

    // Support
    "support.title": "Поддержка",
    "support.newTicket": "Новое обращение",
    "support.subject": "Тема",
    "support.message": "Сообщение",
    "support.priority": "Приоритет",
    "support.low": "Низкий",
    "support.normal": "Обычный",
    "support.high": "Высокий",

    // Automation
    "automation.title": "Автоматизация",
    "automation.reminders": "Напоминания",
    "automation.reviews": "Сбор отзывов",
    "automation.reactivation": "Реактивация клиентов",

    // Channels
    "channels.title": "Каналы связи",
    "channels.telegram": "Telegram",
    "channels.whatsapp": "WhatsApp",
    "channels.instagram": "Instagram",
    "channels.connected": "Подключен",
    "channels.notConnected": "Не подключен",

    // Plans
    "plan.trial": "Пробный период",
    "plan.starter": "Стартовый",
    "plan.pro": "Профессиональный",
    "plan.business": "Бизнес",
  },

  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.aiEmployee": "AI Employee",
    "nav.channels": "Channels",
    "nav.statistics": "Statistics",
    "nav.services": "Services",
    "nav.team": "Team",
    "nav.knowledge": "Knowledge Base",
    "nav.bookings": "Bookings",
    "nav.customers": "Customers",
    "nav.broadcasts": "Broadcasts",
    "nav.automation": "Automation",
    "nav.messages": "Messages",
    "nav.settings": "Settings",
    "nav.help": "Help",
    "nav.logout": "Log out",

    // Sidebar
    "sidebar.yourBusiness": "Your business",
    "sidebar.messages": "Messages",
    "sidebar.daysLeft": "{days} days left",
    "sidebar.choosePlan": "Choose plan",

    // Dashboard
    "dashboard.title": "Dashboard",
    "dashboard.welcome": "Welcome",
    "dashboard.todayStats": "Today's statistics",
    "dashboard.newMessages": "New messages",
    "dashboard.newBookings": "New bookings",
    "dashboard.newCustomers": "New customers",
    "dashboard.messagesUsed": "Messages used",

    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.add": "Add",
    "common.search": "Search",
    "common.loading": "Loading...",
    "common.noData": "No data",
    "common.actions": "Actions",
    "common.status": "Status",
    "common.date": "Date",
    "common.name": "Name",
    "common.phone": "Phone",
    "common.email": "Email",
    "common.price": "Price",
    "common.duration": "Duration",
    "common.minutes": "min",
    "common.currency": "$",

    // Warnings
    "warning.lowMessages": "Low on messages",
    "warning.messagesAlmostOut": "Messages almost depleted!",
    "warning.remaining": "{count} of {total} messages remaining.",
    "warning.upgradePlan": "Upgrade plan",

    // Settings
    "settings.title": "Settings",
    "settings.profile": "Profile",
    "settings.business": "Business",
    "settings.notifications": "Notifications",
    "settings.language": "Interface language",
    "settings.theme": "Theme",
    "settings.themeDark": "Dark",
    "settings.themeLight": "Light",

    // Bot
    "bot.title": "AI Employee",
    "bot.status": "Bot status",
    "bot.active": "Active",
    "bot.inactive": "Inactive",
    "bot.connect": "Connect bot",
    "bot.disconnect": "Disconnect",
    "bot.testBot": "Test bot",

    // Services
    "services.title": "Services",
    "services.addService": "Add service",
    "services.serviceName": "Service name",
    "services.noServices": "No services added",

    // Staff
    "staff.title": "Team",
    "staff.addStaff": "Add staff member",
    "staff.role": "Role",
    "staff.noStaff": "No team members added",

    // FAQ
    "faq.title": "Knowledge Base",
    "faq.addFaq": "Add question",
    "faq.question": "Question",
    "faq.answer": "Answer",
    "faq.noFaqs": "No questions added",

    // Bookings
    "bookings.title": "Bookings",
    "bookings.addBooking": "Add booking",
    "bookings.clientName": "Client name",
    "bookings.service": "Service",
    "bookings.staff": "Staff",
    "bookings.dateTime": "Date and time",
    "bookings.noBookings": "No bookings",
    "bookings.pending": "Pending",
    "bookings.confirmed": "Confirmed",
    "bookings.cancelled": "Cancelled",
    "bookings.completed": "Completed",

    // Customers
    "customers.title": "Customers",
    "customers.totalCustomers": "Total customers",
    "customers.activeCustomers": "Active customers",
    "customers.newThisMonth": "New this month",
    "customers.noCustomers": "No customers yet",

    // Broadcasts
    "broadcasts.title": "Broadcasts",
    "broadcasts.newBroadcast": "New broadcast",
    "broadcasts.recipients": "Recipients",
    "broadcasts.sent": "Sent",
    "broadcasts.draft": "Draft",

    // Statistics
    "statistics.title": "Statistics",
    "statistics.totalMessages": "Total messages",
    "statistics.totalBookings": "Total bookings",
    "statistics.conversionRate": "Conversion rate",

    // Support
    "support.title": "Support",
    "support.newTicket": "New ticket",
    "support.subject": "Subject",
    "support.message": "Message",
    "support.priority": "Priority",
    "support.low": "Low",
    "support.normal": "Normal",
    "support.high": "High",

    // Automation
    "automation.title": "Automation",
    "automation.reminders": "Reminders",
    "automation.reviews": "Review collection",
    "automation.reactivation": "Customer reactivation",

    // Channels
    "channels.title": "Communication channels",
    "channels.telegram": "Telegram",
    "channels.whatsapp": "WhatsApp",
    "channels.instagram": "Instagram",
    "channels.connected": "Connected",
    "channels.notConnected": "Not connected",

    // Plans
    "plan.trial": "Trial",
    "plan.starter": "Starter",
    "plan.pro": "Professional",
    "plan.business": "Business",
  },

  uz: {
    // Navigation
    "nav.dashboard": "Bosh sahifa",
    "nav.aiEmployee": "AI xodim",
    "nav.channels": "Kanallar",
    "nav.statistics": "Statistika",
    "nav.services": "Xizmatlar",
    "nav.team": "Jamoa",
    "nav.knowledge": "Bilimlar bazasi",
    "nav.bookings": "Buyurtmalar",
    "nav.customers": "Mijozlar",
    "nav.broadcasts": "Xabarlar",
    "nav.automation": "Avtomatlashtirish",
    "nav.messages": "Xabarlar",
    "nav.settings": "Sozlamalar",
    "nav.help": "Yordam",
    "nav.logout": "Chiqish",

    // Sidebar
    "sidebar.yourBusiness": "Sizning biznesingiz",
    "sidebar.messages": "Xabarlar",
    "sidebar.daysLeft": "{days} kun qoldi",
    "sidebar.choosePlan": "Tarifni tanlash",

    // Dashboard
    "dashboard.title": "Boshqaruv paneli",
    "dashboard.welcome": "Xush kelibsiz",
    "dashboard.todayStats": "Bugungi statistika",
    "dashboard.newMessages": "Yangi xabarlar",
    "dashboard.newBookings": "Yangi buyurtmalar",
    "dashboard.newCustomers": "Yangi mijozlar",
    "dashboard.messagesUsed": "Ishlatilgan xabarlar",

    // Common
    "common.save": "Saqlash",
    "common.cancel": "Bekor qilish",
    "common.delete": "O'chirish",
    "common.edit": "Tahrirlash",
    "common.add": "Qo'shish",
    "common.search": "Qidirish",
    "common.loading": "Yuklanmoqda...",
    "common.noData": "Ma'lumot yo'q",
    "common.actions": "Harakatlar",
    "common.status": "Holat",
    "common.date": "Sana",
    "common.name": "Ism",
    "common.phone": "Telefon",
    "common.email": "Email",
    "common.price": "Narx",
    "common.duration": "Davomiylik",
    "common.minutes": "daq",
    "common.currency": "so'm",

    // Warnings
    "warning.lowMessages": "Xabarlar kam qoldi",
    "warning.messagesAlmostOut": "Xabarlar tugamoqda!",
    "warning.remaining": "{total} dan {count} ta xabar qoldi.",
    "warning.upgradePlan": "Tarifni yangilash",

    // Settings
    "settings.title": "Sozlamalar",
    "settings.profile": "Profil",
    "settings.business": "Biznes",
    "settings.notifications": "Bildirishnomalar",
    "settings.language": "Interfeys tili",
    "settings.theme": "Mavzu",
    "settings.themeDark": "Qorong'i",
    "settings.themeLight": "Yorug'",

    // Bot
    "bot.title": "AI xodim",
    "bot.status": "Bot holati",
    "bot.active": "Faol",
    "bot.inactive": "Nofaol",
    "bot.connect": "Botni ulash",
    "bot.disconnect": "Uzish",
    "bot.testBot": "Botni sinash",

    // Services
    "services.title": "Xizmatlar",
    "services.addService": "Xizmat qo'shish",
    "services.serviceName": "Xizmat nomi",
    "services.noServices": "Xizmatlar qo'shilmagan",

    // Staff
    "staff.title": "Jamoa",
    "staff.addStaff": "Xodim qo'shish",
    "staff.role": "Lavozim",
    "staff.noStaff": "Xodimlar qo'shilmagan",

    // FAQ
    "faq.title": "Bilimlar bazasi",
    "faq.addFaq": "Savol qo'shish",
    "faq.question": "Savol",
    "faq.answer": "Javob",
    "faq.noFaqs": "Savollar qo'shilmagan",

    // Bookings
    "bookings.title": "Buyurtmalar",
    "bookings.addBooking": "Buyurtma qo'shish",
    "bookings.clientName": "Mijoz ismi",
    "bookings.service": "Xizmat",
    "bookings.staff": "Xodim",
    "bookings.dateTime": "Sana va vaqt",
    "bookings.noBookings": "Buyurtmalar yo'q",
    "bookings.pending": "Kutilmoqda",
    "bookings.confirmed": "Tasdiqlangan",
    "bookings.cancelled": "Bekor qilingan",
    "bookings.completed": "Bajarilgan",

    // Customers
    "customers.title": "Mijozlar",
    "customers.totalCustomers": "Jami mijozlar",
    "customers.activeCustomers": "Faol mijozlar",
    "customers.newThisMonth": "Bu oyda yangi",
    "customers.noCustomers": "Hozircha mijozlar yo'q",

    // Broadcasts
    "broadcasts.title": "Xabar yuborish",
    "broadcasts.newBroadcast": "Yangi xabar",
    "broadcasts.recipients": "Qabul qiluvchilar",
    "broadcasts.sent": "Yuborildi",
    "broadcasts.draft": "Qoralama",

    // Statistics
    "statistics.title": "Statistika",
    "statistics.totalMessages": "Jami xabarlar",
    "statistics.totalBookings": "Jami buyurtmalar",
    "statistics.conversionRate": "Konversiya",

    // Support
    "support.title": "Qo'llab-quvvatlash",
    "support.newTicket": "Yangi murojaat",
    "support.subject": "Mavzu",
    "support.message": "Xabar",
    "support.priority": "Muhimlik",
    "support.low": "Past",
    "support.normal": "O'rta",
    "support.high": "Yuqori",

    // Automation
    "automation.title": "Avtomatlashtirish",
    "automation.reminders": "Eslatmalar",
    "automation.reviews": "Sharhlar yig'ish",
    "automation.reactivation": "Mijozlarni qaytarish",

    // Channels
    "channels.title": "Aloqa kanallari",
    "channels.telegram": "Telegram",
    "channels.whatsapp": "WhatsApp",
    "channels.instagram": "Instagram",
    "channels.connected": "Ulangan",
    "channels.notConnected": "Ulanmagan",

    // Plans
    "plan.trial": "Sinov",
    "plan.starter": "Boshlang'ich",
    "plan.pro": "Professional",
    "plan.business": "Biznes",
  },

  kz: {
    // Navigation
    "nav.dashboard": "Басты бет",
    "nav.aiEmployee": "AI қызметкер",
    "nav.channels": "Арналар",
    "nav.statistics": "Статистика",
    "nav.services": "Қызметтер",
    "nav.team": "Команда",
    "nav.knowledge": "Білім базасы",
    "nav.bookings": "Жазбалар",
    "nav.customers": "Клиенттер",
    "nav.broadcasts": "Хабарламалар",
    "nav.automation": "Автоматтандыру",
    "nav.messages": "Хабарлар",
    "nav.settings": "Баптаулар",
    "nav.help": "Көмек",
    "nav.logout": "Шығу",

    // Sidebar
    "sidebar.yourBusiness": "Сіздің бизнесіңіз",
    "sidebar.messages": "Хабарламалар",
    "sidebar.daysLeft": "{days} күн қалды",
    "sidebar.choosePlan": "Тарифті таңдау",

    // Dashboard
    "dashboard.title": "Басқару панелі",
    "dashboard.welcome": "Қош келдіңіз",
    "dashboard.todayStats": "Бүгінгі статистика",
    "dashboard.newMessages": "Жаңа хабарлар",
    "dashboard.newBookings": "Жаңа жазбалар",
    "dashboard.newCustomers": "Жаңа клиенттер",
    "dashboard.messagesUsed": "Қолданылған хабарлар",

    // Common
    "common.save": "Сақтау",
    "common.cancel": "Болдырмау",
    "common.delete": "Жою",
    "common.edit": "Өңдеу",
    "common.add": "Қосу",
    "common.search": "Іздеу",
    "common.loading": "Жүктелуде...",
    "common.noData": "Деректер жоқ",
    "common.actions": "Әрекеттер",
    "common.status": "Күй",
    "common.date": "Күні",
    "common.name": "Аты",
    "common.phone": "Телефон",
    "common.email": "Email",
    "common.price": "Бағасы",
    "common.duration": "Ұзақтығы",
    "common.minutes": "мин",
    "common.currency": "тг",

    // Warnings
    "warning.lowMessages": "Хабарлар аз қалды",
    "warning.messagesAlmostOut": "Хабарлар таусылуда!",
    "warning.remaining": "{total} ішінен {count} хабар қалды.",
    "warning.upgradePlan": "Тарифті жаңарту",

    // Settings
    "settings.title": "Баптаулар",
    "settings.profile": "Профиль",
    "settings.business": "Бизнес",
    "settings.notifications": "Хабарландырулар",
    "settings.language": "Интерфейс тілі",
    "settings.theme": "Тема",
    "settings.themeDark": "Қараңғы",
    "settings.themeLight": "Жарық",

    // Bot
    "bot.title": "AI қызметкер",
    "bot.status": "Бот күйі",
    "bot.active": "Белсенді",
    "bot.inactive": "Белсенді емес",
    "bot.connect": "Ботты қосу",
    "bot.disconnect": "Ажырату",
    "bot.testBot": "Ботты тексеру",

    // Services
    "services.title": "Қызметтер",
    "services.addService": "Қызмет қосу",
    "services.serviceName": "Қызмет атауы",
    "services.noServices": "Қызметтер қосылмаған",

    // Staff
    "staff.title": "Команда",
    "staff.addStaff": "Қызметкер қосу",
    "staff.role": "Лауазым",
    "staff.noStaff": "Қызметкерлер қосылмаған",

    // FAQ
    "faq.title": "Білім базасы",
    "faq.addFaq": "Сұрақ қосу",
    "faq.question": "Сұрақ",
    "faq.answer": "Жауап",
    "faq.noFaqs": "Сұрақтар қосылмаған",

    // Bookings
    "bookings.title": "Жазбалар",
    "bookings.addBooking": "Жазба қосу",
    "bookings.clientName": "Клиент аты",
    "bookings.service": "Қызмет",
    "bookings.staff": "Қызметкер",
    "bookings.dateTime": "Күні мен уақыты",
    "bookings.noBookings": "Жазбалар жоқ",
    "bookings.pending": "Күтуде",
    "bookings.confirmed": "Расталған",
    "bookings.cancelled": "Болдырылмаған",
    "bookings.completed": "Аяқталған",

    // Customers
    "customers.title": "Клиенттер",
    "customers.totalCustomers": "Барлық клиенттер",
    "customers.activeCustomers": "Белсенді клиенттер",
    "customers.newThisMonth": "Осы айда жаңа",
    "customers.noCustomers": "Әзірге клиенттер жоқ",

    // Broadcasts
    "broadcasts.title": "Хабарлама жіберу",
    "broadcasts.newBroadcast": "Жаңа хабарлама",
    "broadcasts.recipients": "Алушылар",
    "broadcasts.sent": "Жіберілді",
    "broadcasts.draft": "Жоба",

    // Statistics
    "statistics.title": "Статистика",
    "statistics.totalMessages": "Барлық хабарлар",
    "statistics.totalBookings": "Барлық жазбалар",
    "statistics.conversionRate": "Конверсия",

    // Support
    "support.title": "Қолдау",
    "support.newTicket": "Жаңа өтініш",
    "support.subject": "Тақырып",
    "support.message": "Хабар",
    "support.priority": "Маңыздылық",
    "support.low": "Төмен",
    "support.normal": "Орташа",
    "support.high": "Жоғары",

    // Automation
    "automation.title": "Автоматтандыру",
    "automation.reminders": "Еске салулар",
    "automation.reviews": "Пікірлер жинау",
    "automation.reactivation": "Клиенттерді қайтару",

    // Channels
    "channels.title": "Байланыс арналары",
    "channels.telegram": "Telegram",
    "channels.whatsapp": "WhatsApp",
    "channels.instagram": "Instagram",
    "channels.connected": "Қосылған",
    "channels.notConnected": "Қосылмаған",

    // Plans
    "plan.trial": "Сынақ",
    "plan.starter": "Бастапқы",
    "plan.pro": "Кәсіби",
    "plan.business": "Бизнес",
  },
};
