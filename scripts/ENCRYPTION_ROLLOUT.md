# Rollout инструкция — envelope encryption токенов каналов

Один раз пройди этот чек-лист. После завершения все токены каналов в prod-БД зашифрованы. Ключ — единственный секрет который спасает от утечки БД.

## Шаг 0. Что уже готово в коде (сделано мной, задеплоено)

- ✅ `src/lib/crypto.ts` — `encrypt()`, `decrypt()`, `isEncrypted()` (коммит `284de68`)
- ✅ Все writes оборачивают `encrypt()` (коммит `f4075c8`)
- ✅ Все reads оборачивают `decrypt()` (коммит `e4532b8`)
- ✅ Скрипт `scripts/encrypt-existing-tokens.mjs` — бэкфилл

**Текущее состояние в проде:** `ENCRYPTION_MASTER_KEY` env var **не установлен** → код в passthrough-режиме → всё работает как раньше, ничего не зашифровано.

## Шаг 1. Сгенерировать master key (5 минут)

Открой терминал (macOS/Linux/Git Bash):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Вывод — строка длиной ~44 символа, например:
```
G7fJ8vXqL2mN5pQrS3tUvW4yZaB6cDeE9hIkJlNoPqR=
```

**Это твой master key. Не путай, не публикуй, не коммить в git никогда.**

## Шаг 2. Сохранить ключ В ТРЁХ МЕСТАХ (10 минут)

⚠️ Потеря ключа = все зашифрованные токены каналов бесполезны. Клиентам придётся переподключать все каналы. Поэтому три копии обязательны.

1. **1Password (или другой менеджер паролей).** Запись «Staffix ENCRYPTION_MASTER_KEY». Скопировал → сохранил.
2. **Vercel Environment Variables.**
   - Открой https://vercel.com/dashboard → проект staffix → Settings → Environment Variables
   - Add new
   - Name: `ENCRYPTION_MASTER_KEY`
   - Value: строка из шага 1
   - Environments: **Production** ☑ (только production, не Preview/Development)
   - Sensitive: ☑ (чтобы значение не показывалось в UI после сохранения)
   - Save
3. **Оффлайн копия.** Запиши в физический блокнот, положи в сейф. Или распечатай и запечатай в конверт. Не полагайся на облако полностью.

## Шаг 3. Тест на копии БД (30 минут)

⚠️ Никогда не запускай backfill против prod без предварительной проверки на копии.

1. Открой Railway → проект Staffix → PostgreSQL → нажми «Duplicate»
2. Дождись пока копия поднимется (2-5 минут)
3. Скопируй DATABASE_URL копии
4. Локально в терминале:

   ```bash
   cd staffix

   # Windows PowerShell:
   $env:ENCRYPTION_MASTER_KEY="<строка из шага 1>"
   $env:DATABASE_URL="<url копии из шага 3>"
   node scripts/encrypt-existing-tokens.mjs --dry-run

   # macOS/Linux/Git Bash:
   ENCRYPTION_MASTER_KEY=<...> DATABASE_URL=<...> node scripts/encrypt-existing-tokens.mjs --dry-run
   ```

5. Проверь вывод — увидишь список бизнесов и полей, которые будут зашифрованы. Ошибок быть не должно.
6. Если dry-run прошёл нормально → запусти без `--dry-run`:

   ```bash
   node scripts/encrypt-existing-tokens.mjs
   ```

7. Проверь копию БД: открой в Railway → Data → Business → все токены каналов должны быть `v1:...` вместо plaintext.

**Если что-то пошло не так на копии — удалить копию, вернуться к отладке. Prod не тронут.**

## Шаг 4. Активировать шифрование в prod (5 минут)

Порядок важен: **сначала env var в Vercel**, потом backfill.

1. В Vercel Env vars (шаг 2 уже сделан) → **Redeploy** последний деплой (Deployments → три точки → Redeploy)
2. Дождись пока деплой станет зелёным (~2 минуты)
3. Проверь что бизнес-логика работает: отправь сообщение в TG-боту Staffix demo — должен ответить. Это подтвердит что новый деплой с env корректно шифрует новые записи.
4. Прогони backfill против **prod DB**:

   ```bash
   cd staffix
   # env vars как в шаге 3, но DATABASE_URL — prod
   node scripts/encrypt-existing-tokens.mjs --dry-run    # сначала dry-run
   node scripts/encrypt-existing-tokens.mjs              # потом реально
   ```

5. Проверь в Railway prod DB что все Business.botToken / waAccessToken / fbPageAccessToken / metaUserAccessToken / *VerifyToken / webhookSecret начинаются с `v1:`.

## Шаг 5. Smoke-тест каналов (15 минут)

После backfill проверь что каждый канал у каждого активного бизнеса работает.

- **Telegram**: отправь сообщение боту клиента, должен ответить
- **WhatsApp**: если у Right Flight или другого клиента подключён — отправь сообщение
- **Instagram DM**: то же
- **Facebook Messenger**: то же

Если какой-то канал не отвечает:
1. Проверь Vercel logs — есть ли ошибки `[crypto] Encrypted value found but ENCRYPTION_MASTER_KEY not set` (значит env исчез)
2. Или ошибки от Telegram/Meta API «invalid token» (значит расшифровался неправильно)
3. В худшем случае откати env var (удали `ENCRYPTION_MASTER_KEY` в Vercel + Redeploy) — код вернётся в passthrough-режим. Но с уже зашифрованными данными это НЕ поможет — они станут нечитаемы. Тогда ключ нужно восстановить из 1Password/оффлайн копии.

## Шаг 6. Убрать passthrough из crypto.ts (опционально, через 1-2 недели)

Прямо сейчас `crypto.ts` в passthrough-режиме если `ENCRYPTION_MASTER_KEY` не задан. Это защита на переходный период. После того как убедишься что prod стабильно работает 1-2 недели с шифрованием — можно ужесточить: сделать чтобы `encrypt()` бросал ошибку при отсутствии ключа. Это защита от случайного удаления env var (сейчас код молча деградирует, тогда — сломается сразу и заметно).

Скажи когда захочешь — сделаю отдельным коммитом.

## Что делать НЕ надо

- ❌ Не запускать backfill без dry-run сначала
- ❌ Не удалять env var из Vercel после backfill — все токены станут нечитаемы
- ❌ Не менять master key после backfill без re-encrypt всех данных (сначала decrypt старым ключом, потом encrypt новым)
- ❌ Не хранить ключ в git, Slack, email, документе на диске
- ❌ Не давать доступ к ключу тому, у кого нет доступа к prod БД (нет смысла разделять — оба уязвимости эквивалентны)

## Что делать если пришлось экстренно

**Утечка prod БД.** Ключ по-прежнему у тебя → злоумышленник видит только шифротексты, каналы в безопасности. Всё равно рекомендую сменить всё после инцидента (перевыпустить bot token в @BotFather, отозвать WA/FB tokens в Business Manager).

**Утечка master key (без БД).** Ключ бесполезен без БД → мало что можно сделать с ним, но всё равно ротировать: 1) сгенерить новый ключ, 2) написать скрипт decrypt-with-old-encrypt-with-new-then-swap, 3) rollout по такому же чеку как этот.

**Утечка обоих одновременно.** Худший сценарий. Отозвать все токены каналов, попросить всех клиентов переподключить.
