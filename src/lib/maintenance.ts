/**
 * Заглушка «проект в разработке» — сайт закрыт для посетителей (4 ноября 2026).
 *
 * ПОЧЕМУ КОНСТАНТА, А НЕ ПЕРЕМЕННАЯ ОКРУЖЕНИЯ. 4 октября регистрацию закрыли
 * через `STAFFIX_SIGNUP_CLOSED`, но переменную в Vercel никто не выставил —
 * и 1 ноября человек спокойно зарегистрировался и прошёл онбординг. Выключатель,
 * который требует отдельного действия, в этом проекте не срабатывает.
 * Поэтому режим зашит в код и действует сразу после деплоя.
 *
 * ЧТОБЫ ВЕРНУТЬ САЙТ: поменять на `false` ниже и задеплоить. Одна строка.
 *
 * ИСКЛЮЧЕНИЙ НЕТ. Ни входа, ни авторизации, ни дашборда — проект закрыт
 * целиком. Промежуточная версия оставляла доступной страницу входа «чтобы
 * владелец мог зайти»; это было отступлением от задачи, и её убрали.
 * Ключа обхода в коде тоже нет: секретам не место в исходниках.
 *
 * Данные при этом никуда не делись — к базе обращаемся напрямую, дашборд для
 * этого не нужен.
 */
export const MAINTENANCE_MODE = true;

/**
 * Вебхуки Meta и Telegram заглушкой НЕ закрываем, а отвечаем пустым 200.
 *
 * Причина практическая: на повторяющиеся ошибки Meta отключает подписку
 * страницы, а Telegram — вебхук бота. Тогда после возвращения проекта каналы
 * пришлось бы переподключать руками у каждого клиента. Пустой 200 ничего не
 * исполняет (боты всё равно выключены, вызовы в Anthropic запрещены), но
 * платформы считают доставку успешной.
 */
export const WEBHOOK_PREFIXES = [
  "/api/telegram/webhook",
  // Бот поддержки Staffix — отдельный вебхук, который я чуть не пропустил;
  // его нашёл тест, сверяющий этот список с роутами в репозитории.
  "/api/telegram/support-webhook",
  "/api/instagram/webhook",
  "/api/facebook/webhook",
  "/api/whatsapp/webhook",
  "/api/sales-bot/",
  "/api/webhooks/",
];

/**
 * Пути, которые заглушка пропускает К РОУТУ и которые реально выполняются.
 *
 * Отличие от WEBHOOK_PREFIXES: там мы отвечаем пустым 200 и не делаем ничего,
 * здесь запрос обрабатывается по-настоящему.
 *
 * Удаление данных по запросу пользователя Meta — обязательство по их
 * Platform Terms (раздел 3(d)(i)), а не функция продукта. Заглушка отдавала
 * сюда 503, то есть запросы на удаление молча не исполнялись. Закрытый проект
 * не освобождает от удаления персональных данных.
 *
 * Сюда же страница статуса: её адрес мы сами отдаём Meta в ответе колбэка,
 * и по нему человек проверяет, что его данные удалены.
 */
export const ALWAYS_ALLOWED_PREFIXES = [
  "/api/meta/data-deletion",
  "/meta/deletion-status",
];

/** Страница-заглушка. Самодостаточная: без шрифтов, картинок и скриптов. */
export const MAINTENANCE_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Staffix — в разработке</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: #0b1020; color: #e8ecf8;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  }
  .card {
    max-width: 520px; width: 100%; text-align: center;
    background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
    border-radius: 18px; padding: 40px 28px;
  }
  .logo { font-size: 22px; font-weight: 700; letter-spacing: .02em; }
  h1 { font-size: 20px; margin: 20px 0 10px; font-weight: 600; }
  p { margin: 0; color: #a9b4cf; font-size: 15px; }
  .mail { margin-top: 22px; }
  .mail a { color: #e8ecf8; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,.3); }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">Staffix</div>
    <h1>Проект в стадии разработки</h1>
    <p>Сервис временно недоступен — мы его дорабатываем. Зайдите, пожалуйста, позже.</p>
    <p class="mail"><a href="mailto:info@staffix.io">info@staffix.io</a></p>
  </div>
</body>
</html>`;
