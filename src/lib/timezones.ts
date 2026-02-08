// Client-safe timezone list for UI selectors
// Matches TIMEZONE_OFFSETS in automation.ts

const TIMEZONE_OFFSETS: Record<string, number> = {
  // CIS & Central Asia
  "Asia/Tashkent": 300,
  "Asia/Almaty": 300,
  "Asia/Bishkek": 360,
  "Asia/Dushanbe": 300,
  "Asia/Ashgabat": 300,
  "Asia/Baku": 240,
  "Asia/Yerevan": 240,
  "Asia/Tbilisi": 240,

  // Россия (11 зон)
  "Europe/Kaliningrad": 120,
  "Europe/Moscow": 180,
  "Europe/Samara": 240,
  "Asia/Yekaterinburg": 300,
  "Asia/Omsk": 360,
  "Asia/Novosibirsk": 420,
  "Asia/Krasnoyarsk": 420,
  "Asia/Irkutsk": 480,
  "Asia/Yakutsk": 540,
  "Asia/Vladivostok": 600,
  "Asia/Kamchatka": 720,

  // Корея, Япония, Китай
  "Asia/Seoul": 540,
  "Asia/Tokyo": 540,
  "Asia/Shanghai": 480,

  // Ближний Восток
  "Asia/Dubai": 240,
  "Asia/Riyadh": 180,
  "Asia/Istanbul": 180,

  // Европа
  "Europe/London": 0,
  "Europe/Berlin": 60,
  "Europe/Paris": 60,
  "Europe/Kiev": 120,

  // Америка
  "America/New_York": -300,
  "America/Chicago": -360,
  "America/Denver": -420,
  "America/Los_Angeles": -480,
};

// Readable city names for UI
const CITY_NAMES: Record<string, string> = {
  "Asia/Tashkent": "Ташкент",
  "Asia/Almaty": "Алматы",
  "Asia/Bishkek": "Бишкек",
  "Asia/Dushanbe": "Душанбе",
  "Asia/Ashgabat": "Ашхабад",
  "Asia/Baku": "Баку",
  "Asia/Yerevan": "Ереван",
  "Asia/Tbilisi": "Тбилиси",
  "Europe/Kaliningrad": "Калининград",
  "Europe/Moscow": "Москва",
  "Europe/Samara": "Самара",
  "Asia/Yekaterinburg": "Екатеринбург",
  "Asia/Omsk": "Омск",
  "Asia/Novosibirsk": "Новосибирск",
  "Asia/Krasnoyarsk": "Красноярск",
  "Asia/Irkutsk": "Иркутск",
  "Asia/Yakutsk": "Якутск",
  "Asia/Vladivostok": "Владивосток",
  "Asia/Kamchatka": "Камчатка",
  "Asia/Seoul": "Сеул",
  "Asia/Tokyo": "Токио",
  "Asia/Shanghai": "Шанхай",
  "Asia/Dubai": "Дубай",
  "Asia/Riyadh": "Эр-Рияд",
  "Asia/Istanbul": "Стамбул",
  "Europe/London": "Лондон",
  "Europe/Berlin": "Берлин",
  "Europe/Paris": "Париж",
  "Europe/Kiev": "Киев",
  "America/New_York": "Нью-Йорк",
  "America/Chicago": "Чикаго",
  "America/Denver": "Денвер",
  "America/Los_Angeles": "Лос-Анджелес",
};

export const TIMEZONES = Object.entries(TIMEZONE_OFFSETS)
  .map(([tz, offset]) => {
    const sign = offset >= 0 ? "+" : "-";
    const h = Math.floor(Math.abs(offset) / 60);
    const m = Math.abs(offset) % 60;
    const utc = `UTC${sign}${h}${m ? `:${m.toString().padStart(2, "0")}` : ""}`;
    const city = CITY_NAMES[tz] || tz.split("/")[1]?.replace(/_/g, " ") || tz;
    return { value: tz, label: `${utc} — ${city}`, offset };
  })
  .sort((a, b) => a.offset - b.offset);
