"use client";

/**
 * AnalyticsScripts — единый загрузчик третьесторонней аналитики.
 *
 * Правила:
 *   1. НИКОГДА не инжектит скрипты до того как пользователь нажал "Accept" в
 *      баннере cookie-consent. Без accepted — компонент рендерит null.
 *   2. Обрабатывает три сервиса:
 *        - GA4 (NEXT_PUBLIC_GA4_ID)         — трафик и конверсии
 *        - Meta Pixel (NEXT_PUBLIC_META_PIXEL_ID) — retargeting для FB/IG ads
 *        - PostHog (NEXT_PUBLIC_POSTHOG_KEY + HOST) — product analytics
 *   3. Каждый сервис независим — если env-var не задан, тот скрипт не грузится
 *      (позволяет частичное включение).
 *   4. Отслеживает изменения консента через onConsentChange — если пользователь
 *      позже отзовёт согласие, скрипты уже подгруженные жить продолжат до
 *      перезагрузки страницы (браузер не даёт unload script tag), но новые
 *      посетители в той же сессии больше ничего не подгрузят.
 */

import { useEffect, useState } from "react";
import Script from "next/script";
import { getConsent, onConsentChange } from "@/lib/analytics-consent";

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

// "Do Not Track" сигнал браузера. Уважаем его: даже с accepted-consent,
// если DNT=1, скрипты не грузим. Обещание из Privacy Policy §9.
function isDntEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { msDoNotTrack?: string };
  const dnt = nav.doNotTrack || nav.msDoNotTrack || (window as unknown as { doNotTrack?: string }).doNotTrack;
  return dnt === "1" || dnt === "yes";
}

export default function AnalyticsScripts() {
  const [consented, setConsented] = useState<boolean>(false);

  useEffect(() => {
    // Гейт 1: браузер сказал Do Not Track — вообще ничего не грузим,
    // независимо от cookie-consent. Стандарт W3C уважаем.
    if (isDntEnabled()) return;

    // Гейт 2: cookie-consent. На маунте берём текущее значение.
    setConsented(getConsent() === "accepted");

    // И слушаем изменения — если посетитель нажмёт Accept сейчас, обновимся.
    const off = onConsentChange((v) => setConsented(v === "accepted"));
    return off;
  }, []);

  if (!consented) return null;

  return (
    <>
      {/* Google Analytics 4 */}
      {GA4_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA4_ID}', { send_page_view: true });
            `}
          </Script>
        </>
      ) : null}

      {/* Meta Pixel (FB/IG retargeting + attribution) */}
      {META_PIXEL_ID ? (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
          {/* noscript-фолбэк для клиентов без JS (Meta требует по докам) */}
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      ) : null}

      {/* PostHog — product analytics + session recordings + feature flags.
          Инициализируем ЯВНО с disable_session_recording=false; identify юзера
          делает отдельный компонент src/components/PostHogIdentify.tsx на
          страницах дашборда. */}
      {POSTHOG_KEY ? (
        <Script id="posthog-init" strategy="afterInteractive">
          {`
            !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init me ws ys ps bs capture je Di ks register register_once register_for_session unregister unregister_for_session Ps getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Es $s createPersonProfile Is opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing Ss debug xs getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
            posthog.init('${POSTHOG_KEY}', {
              api_host: '${POSTHOG_HOST}',
              person_profiles: 'identified_only',
              capture_pageview: true,
              capture_pageleave: true,
              autocapture: true,
              disable_session_recording: false,
              opt_out_useragent_filter: false
            });
          `}
        </Script>
      ) : null}
    </>
  );
}
