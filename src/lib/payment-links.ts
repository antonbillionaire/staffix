/**
 * Payment Link Generator for Payme, Click, Kaspi
 * Генерация ссылок на оплату без API регистрации.
 * Деньги идут напрямую на счёт владельца.
 */

interface BusinessPaymentConfig {
  paymeId?: string | null;
  clickServiceId?: string | null;
  clickMerchantId?: string | null;
  kaspiPayLink?: string | null;
}

/**
 * Payme checkout link
 * amount — сумма в сумах (целое число)
 * Payme принимает сумму в тийинах (1 сум = 100 тийин)
 */
export function buildPaymeLink(
  merchantId: string,
  amountSum: number,
  orderId: string | number
): string {
  const amountTiyin = Math.round(amountSum * 100);
  const params = {
    m: merchantId,
    "ac.order_id": String(orderId),
    a: amountTiyin,
  };
  const encoded = Buffer.from(JSON.stringify(params)).toString("base64");
  return `https://checkout.paycom.uz/${encoded}`;
}

/**
 * Click checkout link
 * amount — сумма в сумах
 */
export function buildClickLink(
  serviceId: string,
  merchantId: string,
  amountSum: number,
  orderId: string | number
): string {
  const params = new URLSearchParams({
    service_id: serviceId,
    merchant_id: merchantId,
    amount: String(Math.round(amountSum)),
    transaction_param: `ORDER_${orderId}`,
  });
  return `https://my.click.uz/services/pay?${params.toString()}`;
}

/**
 * Возвращает массив Telegram inline keyboard кнопок для оплаты.
 * Каждая кнопка = один провайдер.
 * Только провайдеры у которых настроены credentials.
 */
export function getPaymentButtons(
  business: BusinessPaymentConfig,
  amountSum: number,
  orderNumber: string | number
): { text: string; url: string }[][] {
  const buttons: { text: string; url: string }[] = [];

  if (business.paymeId) {
    buttons.push({
      text: "💳 Payme",
      url: buildPaymeLink(business.paymeId, amountSum, orderNumber),
    });
  }

  if (business.clickServiceId && business.clickMerchantId) {
    buttons.push({
      text: "💳 Click",
      url: buildClickLink(
        business.clickServiceId,
        business.clickMerchantId,
        amountSum,
        orderNumber
      ),
    });
  }

  if (business.kaspiPayLink) {
    buttons.push({
      text: "💳 Kaspi Pay",
      url: business.kaspiPayLink,
    });
  }

  if (buttons.length === 0) return [];

  // Telegram inline keyboard: массив строк, каждая строка — массив кнопок
  // Разбиваем по 2 кнопки в ряд
  const rows: { text: string; url: string }[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  return rows;
}

/**
 * Текст для Kaspi Pay (без динамической ссылки)
 * Возвращает строку которую бот добавит к сообщению об оплате
 */
export function getKaspiPayText(
  kaspiPayLink: string,
  amountSum: number,
  orderNumber: string | number
): string {
  return `💳 <b>Kaspi Pay:</b> ${kaspiPayLink}\nСумма: <b>${amountSum.toLocaleString("ru-RU")} тнг</b> | Заказ #${orderNumber}`;
}
