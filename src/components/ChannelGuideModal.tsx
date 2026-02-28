"use client";

import { useState } from "react";
import { X, BookOpen, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface GuideStep {
  title: string;
  description: string;
}

interface GuideSection {
  icon: "check" | "warning";
  title: string;
  items: string[];
}

interface ChannelGuideProps {
  channel: "whatsapp" | "meta";
}

const whatsappGuide = {
  title: "Подключение WhatsApp",
  intro: "Подключите WhatsApp Business к Staffix за 2 минуты. AI-сотрудник начнёт отвечать клиентам автоматически.",
  beforeStart: {
    title: "Что нужно для подключения",
    items: [
      "Аккаунт Facebook (личный — для авторизации)",
      "Номер телефона для WhatsApp (можно мобильный, городской или виртуальный)",
      "Этот номер НЕ должен быть привязан к обычному WhatsApp — иначе он отключится от телефона",
    ],
  },
  steps: [
    {
      title: "Нажмите «Подключить WhatsApp»",
      description: "Откроется окно авторизации Facebook.",
    },
    {
      title: "Войдите в Facebook",
      description: "Используйте свой личный аккаунт Facebook. Это нужно только для авторизации.",
    },
    {
      title: "Создайте или выберите WhatsApp Business Account",
      description: "Если у вас уже есть WABA — выберите его. Если нет — система предложит создать новый (введите название бизнеса).",
    },
    {
      title: "Введите номер телефона",
      description: "Укажите номер для WhatsApp бота. На него придёт SMS или звонок с кодом подтверждения.",
    },
    {
      title: "Подтвердите код и сохраните",
      description: "Введите код, нажмите «Сохранить». Готово! Бот начнёт отвечать на входящие сообщения.",
    },
  ] as GuideStep[],
  important: {
    title: "Важно знать",
    items: [
      "Номер переносится в WhatsApp Cloud API — он отключится от приложения WhatsApp на телефоне. Рекомендуем использовать отдельный номер.",
      "Первые 1000 сервисных диалогов в месяц — бесплатно (клиент пишет первым).",
      "Для рассылок и уведомлений может потребоваться верификация бизнеса в Meta Business Suite.",
      "Лимит без верификации: 250 уникальных клиентов в сутки. После верификации — до 100,000.",
    ],
  },
};

const metaGuide = {
  title: "Подключение Instagram и Facebook",
  intro: "Подключите Instagram Direct и Facebook Messenger к Staffix. AI-сотрудник будет отвечать клиентам в обоих каналах.",
  beforeStart: {
    title: "Что нужно для подключения",
    items: [
      "Аккаунт Facebook с правами администратора бизнес-страницы",
      "Бизнес-страница Facebook (не личный профиль)",
      "Для Instagram: Instagram Professional аккаунт (бизнес или автор), привязанный к Facebook-странице",
    ],
  },
  steps: [
    {
      title: "Нажмите «Подключить через Facebook»",
      description: "Откроется окно авторизации Facebook.",
    },
    {
      title: "Войдите в Facebook",
      description: "Используйте аккаунт, который является администратором нужной бизнес-страницы.",
    },
    {
      title: "Выберите страницу",
      description: "Выберите Facebook-страницу вашего бизнеса. К ней должен быть привязан Instagram аккаунт (если хотите подключить Instagram DM).",
    },
    {
      title: "Подтвердите разрешения",
      description: "Разрешите Staffix отправлять и читать сообщения. Это нужно для работы AI-бота.",
    },
    {
      title: "Готово!",
      description: "Бот начнёт отвечать на сообщения в Instagram Direct и Facebook Messenger автоматически.",
    },
  ] as GuideStep[],
  important: {
    title: "Важно знать",
    items: [
      "Instagram аккаунт должен быть Professional (бизнес или автор). Личные аккаунты не поддерживают API сообщений.",
      "Instagram должен быть привязан к Facebook-странице: Instagram → Настройки → Аккаунт → Привязанные аккаунты → Facebook.",
      "Если у вас несколько страниц — выберите ту, к которой привязан нужный Instagram.",
      "Бот отвечает только на новые сообщения после подключения, старые переписки не затрагиваются.",
    ],
  },
};

export default function ChannelGuideModal({ channel }: ChannelGuideProps) {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const guide = channel === "whatsapp" ? whatsappGuide : metaGuide;

  const bgCard = isDark ? "bg-gray-800" : "bg-white";
  const bgOverlay = "bg-black/50";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const border = isDark ? "border-gray-700" : "border-gray-200";
  const bgSection = isDark ? "bg-gray-700/50" : "bg-gray-50";

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border ${border} ${bgSection} hover:opacity-80 transition-all mb-4`}
      >
        <BookOpen className={`h-5 w-5 ${channel === "whatsapp" ? "text-green-500" : "text-blue-500"}`} />
        <span className={`text-sm font-medium ${textPrimary}`}>
          Прочитайте перед подключением
        </span>
        <ArrowRight className={`h-4 w-4 ${textSecondary} ml-auto`} />
      </button>

      {/* Modal */}
      {open && (
        <div className={`fixed inset-0 z-50 ${bgOverlay} flex items-center justify-center p-4`}>
          <div
            className={`${bgCard} rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto`}
          >
            {/* Header */}
            <div className={`sticky top-0 ${bgCard} border-b ${border} px-6 py-4 flex items-center justify-between rounded-t-2xl z-10`}>
              <h2 className={`text-lg font-bold ${textPrimary}`}>{guide.title}</h2>
              <button
                onClick={() => setOpen(false)}
                className={`p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Intro */}
              <p className={`${textSecondary} text-sm`}>{guide.intro}</p>

              {/* Before start */}
              <div className={`${bgSection} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <h3 className={`text-sm font-semibold ${textPrimary}`}>{guide.beforeStart.title}</h3>
                </div>
                <ul className="space-y-2">
                  {guide.beforeStart.items.map((item, i) => (
                    <li key={i} className={`text-sm ${textSecondary} flex gap-2`}>
                      <span className="text-green-500 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Steps */}
              <div>
                <h3 className={`text-sm font-semibold ${textPrimary} mb-3`}>Шаги подключения</h3>
                <div className="space-y-3">
                  {guide.steps.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        channel === "whatsapp"
                          ? "bg-green-500/20 text-green-600 dark:text-green-400"
                          : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${textPrimary}`}>{step.title}</p>
                        <p className={`text-xs ${textSecondary} mt-0.5`}>{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Important */}
              <div className={`border ${isDark ? "border-amber-500/30 bg-amber-500/10" : "border-amber-200 bg-amber-50"} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h3 className={`text-sm font-semibold ${textPrimary}`}>{guide.important.title}</h3>
                </div>
                <ul className="space-y-2">
                  {guide.important.items.map((item, i) => (
                    <li key={i} className={`text-sm ${textSecondary} flex gap-2`}>
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className={`sticky bottom-0 ${bgCard} border-t ${border} px-6 py-4 rounded-b-2xl`}>
              <button
                onClick={() => setOpen(false)}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                  channel === "whatsapp"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                Понятно, подключить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
