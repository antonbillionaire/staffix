/**
 * Публичный JS-loader виджета Staffix (Sprint Widget, 21 июля 2026).
 *
 * Клиент вставляет одну строку на свой сайт:
 *   <script async src="https://staffix.io/widget/loader.js" data-business-id="XXX"></script>
 *
 * Скрипт:
 *   1. Читает data-business-id из своего <script>-тега.
 *   2. Fetch /api/widget/[businessId]/config (CORS *, кэш 5 мин).
 *   3. Рендерит плавающую кнопку справа-снизу.
 *   4. Клик → всплывает панель с 3-4 кнопками мессенджеров.
 *   5. Клик по мессенджеру → target="_blank" на deep-link.
 *
 * Без React, без зависимостей. Всё вшито в один self-invoking JS.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WIDGET_SCRIPT = `(function(){
  'use strict';
  if (window.__staffixWidgetLoaded) return;
  window.__staffixWidgetLoaded = true;

  // Найти свой <script>-тег — там data-business-id
  var scripts = document.getElementsByTagName('script');
  var self = null;
  for (var i = scripts.length - 1; i >= 0; i--) {
    var src = scripts[i].getAttribute('src') || '';
    if (src.indexOf('/widget/loader.js') !== -1) { self = scripts[i]; break; }
  }
  if (!self) return;
  var businessId = self.getAttribute('data-business-id');
  if (!businessId) {
    console.warn('[Staffix Widget] data-business-id attribute missing on <script> tag');
    return;
  }
  var origin = new URL(self.src).origin;

  // Иконки мессенджеров (inline SVG чтобы не грузить внешние ассеты и не
  // ломаться на строгом CSP клиента)
  var ICONS = {
    telegram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>',
    whatsapp: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>',
    instagram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
    messenger: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 00-.64.05l-2.39 1.05a.96.96 0 01-1.35-.85l-.07-2.14a.97.97 0 00-.32-.68A11.39 11.39 0 01.002 11.64zm8.32-2.19l-3.52 5.6c-.35.53.32 1.14.82.75L9.4 13.15a.73.73 0 01.87 0l2.77 2.08c.83.62 2.02.4 2.57-.48l3.52-5.6c.35-.53-.32-1.14-.82-.75L14.55 11.1a.73.73 0 01-.87 0L10.9 9.02a1.86 1.86 0 00-2.58.43z"/></svg>',
  };

  var COLORS = {
    telegram: '#26A5E4',
    whatsapp: '#25D366',
    instagram: '#E4405F',
    messenger: '#0084FF',
  };

  // visitor_id — стабильный anonymous ID посетителя. Живёт в localStorage
  // 30 дней. При возврате продолжаем тот же диалог с ботом.
  var VISITOR_ID_KEY = 'staffix_visitor_id';
  var CHAT_HISTORY_KEY = 'staffix_chat_' + businessId;

  function getVisitorId() {
    try {
      var id = localStorage.getItem(VISITOR_ID_KEY);
      if (id && /^[a-zA-Z0-9_-]{8,64}$/.test(id)) return id;
      // Генерируем UUID-совместимый ID (crypto.randomUUID есть везде с 2022)
      var newId;
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        newId = crypto.randomUUID().replace(/-/g, '');
      } else {
        // Fallback для очень старых браузеров
        newId = 'v' + Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
      }
      localStorage.setItem(VISITOR_ID_KEY, newId);
      return newId;
    } catch (e) {
      // localStorage может быть отключён (private mode, GDPR opt-out) —
      // тогда каждая сессия = новый visitor. Не сломается, просто без continuity.
      return 'v' + Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
    }
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(CHAT_HISTORY_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-20) : [];
    } catch (e) { return []; }
  }

  function saveHistory(msgs) {
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(msgs.slice(-20)));
    } catch (e) { /* quota exceeded etc — ignore */ }
  }

  fetch(origin + '/api/widget/' + encodeURIComponent(businessId) + '/config')
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(cfg){
      // Даже если каналов нет — рендерим виджет для веб-чата.
      // Раньше при channels.length===0 виджет не появлялся, теперь чат работает
      // независимо от мессенджеров.
      renderWidget(cfg);
    })
    .catch(function(err){
      console.warn('[Staffix Widget] config load failed:', err);
    });

  // Preset trigger icons. 'custom' обрабатывается отдельно (рендерим <img>).
  var TRIGGER_ICONS = {
    chat: '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
    dots: '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>',
    sparkle: '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2zm7 12l.8 2.7L22 17.5l-2.2.8L19 21l-.8-2.7L16 17.5l2.2-.8L19 14zM5 15l.6 2.4L8 18l-2.4.6L5 21l-.6-2.4L2 18l2.4-.6L5 15z"/></svg>',
    wave: '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M23 11.01L18 11c-.55 0-1 .45-1 1s.45 1 1 1l5 .01c.55 0 1-.45 1-1s-.45-1-1-1zm-2.24 5.66l-4.24-2.65c-.62-.39-1.44-.19-1.79.44-.28.51-.13 1.15.36 1.48l4.19 2.65c.62.39 1.43.2 1.79-.44.28-.51.13-1.16-.31-1.48zm-4.4-8.79l4.24-2.65c.44-.32.59-.97.31-1.48-.36-.64-1.17-.83-1.79-.44l-4.19 2.65c-.49.33-.64.97-.36 1.48.35.63 1.17.83 1.79.44zM9 14c1.66 0 3-1.34 3-3S10.66 8 9 8s-3 1.34-3 3 1.34 3 3 3zm3 3H6c-2.21 0-4 1.79-4 4h14c0-2.21-1.79-4-4-4z"/></svg>',
  };

  function renderTriggerContent(cfg) {
    if (cfg.theme.icon === 'custom' && cfg.theme.customImageUrl) {
      // Кастомная картинка — квадрат внутри круглой кнопки, обрезаем в круг
      return '<img src="' + escAttr(cfg.theme.customImageUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />';
    }
    return TRIGGER_ICONS[cfg.theme.icon] || TRIGGER_ICONS.chat;
  }

  function escAttr(s) {
    // Минимальный escape для значений внутри атрибутов, чтобы кастомный URL
    // не сломал HTML. Для src достаточно " и <.
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function escHtml(s) {
    // Экранирование текста сообщения для innerHTML.
    // Даже если сам бот не выдаст XSS, посетитель может ввести <script> —
    // а мы отображаем его же сообщения в чате. Строгий escape.
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderWidget(cfg) {
    var position = cfg.theme.position === 'bl' ? 'left:20px;' : 'right:20px;';
    var color = cfg.theme.color || '#2563eb';
    var hasCustomImg = cfg.theme.icon === 'custom' && cfg.theme.customImageUrl;
    var visitorId = getVisitorId();
    var chatHistory = loadHistory();

    var container = document.createElement('div');
    container.id = '__staffix-widget';
    container.style.cssText = 'position:fixed;bottom:20px;' + position + 'z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;';

    // Кнопка-триггер.
    var btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Открыть чат');
    var btnBg = hasCustomImg ? 'transparent' : color;
    btn.style.cssText = 'width:60px;height:60px;border-radius:50%;background:' + btnBg + ';border:none;box-shadow:0 4px 12px rgba(0,0,0,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;transition:transform .15s;padding:0;overflow:hidden;';
    btn.onmouseover = function(){ btn.style.transform = 'scale(1.08)'; };
    btn.onmouseout = function(){ btn.style.transform = 'scale(1)'; };
    btn.innerHTML = renderTriggerContent(cfg);

    // Панель чата — большая, с историей сообщений, инпутом и кнопками мессенджеров.
    var panel = document.createElement('div');
    var panelSide = cfg.theme.position === 'bl' ? 'left:0;' : 'right:0;';
    panel.style.cssText = 'position:absolute;bottom:76px;' + panelSide + 'width:360px;max-width:calc(100vw - 40px);height:500px;max-height:calc(100vh - 120px);background:white;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;';

    // Header — имя бизнеса + closing X
    var header = document.createElement('div');
    header.style.cssText = 'padding:14px 16px;background:' + color + ';color:white;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
    var headerTitle = document.createElement('div');
    headerTitle.style.cssText = 'font-size:15px;font-weight:600;';
    headerTitle.textContent = cfg.name || 'Чат';
    header.appendChild(headerTitle);
    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Закрыть');
    closeBtn.style.cssText = 'background:transparent;border:none;color:white;cursor:pointer;font-size:22px;line-height:1;padding:4px 8px;opacity:0.8;';
    closeBtn.innerHTML = '&times;';
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Область сообщений — прокручиваемый список
    var messagesEl = document.createElement('div');
    messagesEl.style.cssText = 'flex:1;overflow-y:auto;padding:14px;background:#f7f8fa;';
    panel.appendChild(messagesEl);

    // "Печатает..." индикатор — прячется по умолчанию
    var typingEl = document.createElement('div');
    typingEl.style.cssText = 'padding:0 14px 8px;font-size:12px;color:#888;background:#f7f8fa;display:none;';
    typingEl.textContent = 'печатает...';
    panel.appendChild(typingEl);

    // Инпут + кнопка отправки
    var inputRow = document.createElement('form');
    inputRow.style.cssText = 'padding:10px;background:white;border-top:1px solid #eee;display:flex;gap:8px;flex-shrink:0;';
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Напишите сообщение...';
    input.maxLength = 1000;
    input.style.cssText = 'flex:1;padding:10px 12px;border:1px solid #ddd;border-radius:20px;font-size:14px;outline:none;font-family:inherit;';
    input.onfocus = function(){ input.style.borderColor = color; };
    input.onblur = function(){ input.style.borderColor = '#ddd'; };
    // Honeypot — скрытое поле "website". Бот заполнит, человек — нет.
    var honeypot = document.createElement('input');
    honeypot.type = 'text';
    honeypot.name = 'website';
    honeypot.tabIndex = -1;
    honeypot.autocomplete = 'off';
    honeypot.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
    var sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.setAttribute('aria-label', 'Отправить');
    sendBtn.style.cssText = 'width:40px;height:40px;border-radius:50%;background:' + color + ';border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
    sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>';
    inputRow.appendChild(input);
    inputRow.appendChild(honeypot);
    inputRow.appendChild(sendBtn);
    panel.appendChild(inputRow);

    // Кнопки мессенджеров внизу — только если каналы есть
    if (cfg.channels && cfg.channels.length > 0) {
      var messengers = document.createElement('div');
      messengers.style.cssText = 'padding:8px 14px 10px;background:white;border-top:1px solid #f0f0f0;flex-shrink:0;';
      var mHeader = document.createElement('div');
      mHeader.style.cssText = 'font-size:11px;color:#888;margin-bottom:6px;';
      mHeader.textContent = 'Или напишите в мессенджер:';
      messengers.appendChild(mHeader);
      var mRow = document.createElement('div');
      mRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
      cfg.channels.forEach(function(ch){
        var a = document.createElement('a');
        a.href = ch.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = ch.label;
        a.style.cssText = 'width:36px;height:36px;border-radius:50%;background:#f5f5f5;color:' + (COLORS[ch.type] || color) + ';display:flex;align-items:center;justify-content:center;text-decoration:none;transition:transform .15s;';
        a.onmouseover = function(){ a.style.transform = 'scale(1.1)'; };
        a.onmouseout = function(){ a.style.transform = 'scale(1)'; };
        a.innerHTML = ICONS[ch.type] || '';
        mRow.appendChild(a);
      });
      messengers.appendChild(mRow);
      panel.appendChild(messengers);
    }

    // Powered by Staffix футер
    var footer = document.createElement('div');
    footer.style.cssText = 'padding:6px;text-align:center;font-size:10px;color:#aaa;background:white;flex-shrink:0;';
    footer.innerHTML = 'Powered by <a href="https://staffix.io" target="_blank" rel="noopener" style="color:#888;text-decoration:none;font-weight:600;">Staffix</a>';
    panel.appendChild(footer);

    // ── Логика сообщений ────────────────────────────────────────────
    function renderMessage(role, content) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'margin-bottom:8px;display:flex;' + (role === 'user' ? 'justify-content:flex-end;' : 'justify-content:flex-start;');
      var bubble = document.createElement('div');
      bubble.style.cssText = 'max-width:78%;padding:8px 12px;border-radius:14px;font-size:14px;line-height:1.4;word-wrap:break-word;white-space:pre-wrap;' +
        (role === 'user'
          ? 'background:' + color + ';color:white;border-bottom-right-radius:4px;'
          : 'background:white;color:#222;border:1px solid #e8e8e8;border-bottom-left-radius:4px;');
      bubble.innerHTML = escHtml(content);
      wrap.appendChild(bubble);
      messagesEl.appendChild(wrap);
      // Скролл вниз к последнему сообщению
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // Рендерим welcome + сохранённую историю
    if (chatHistory.length === 0) {
      var welcome = cfg.theme.greeting || 'Здравствуйте! Чем могу помочь?';
      chatHistory.push({ role: 'assistant', content: welcome });
      saveHistory(chatHistory);
    }
    chatHistory.forEach(function(m){ renderMessage(m.role, m.content); });

    function sendMessage(text) {
      if (!text || !text.trim()) return;
      var trimmed = text.trim().substring(0, 1000);

      // Отображаем user сообщение сразу
      chatHistory.push({ role: 'user', content: trimmed });
      renderMessage('user', trimmed);
      saveHistory(chatHistory);
      input.value = '';
      input.disabled = true;
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.5';
      typingEl.style.display = 'block';

      fetch(origin + '/api/widget/' + encodeURIComponent(businessId) + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          visitor_id: visitorId,
          website: honeypot.value, // если бот заполнил — сервер отсеет
        }),
      })
        .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, data: j }; }); })
        .then(function(res){
          typingEl.style.display = 'none';
          input.disabled = false;
          sendBtn.disabled = false;
          sendBtn.style.opacity = '1';
          var reply = res.data && res.data.reply
            ? res.data.reply
            : (res.data && res.data.error) || 'Извините, что-то пошло не так. Попробуйте ещё раз или напишите в мессенджер.';
          chatHistory.push({ role: 'assistant', content: reply });
          renderMessage('assistant', reply);
          saveHistory(chatHistory);
          input.focus();
        })
        .catch(function(err){
          typingEl.style.display = 'none';
          input.disabled = false;
          sendBtn.disabled = false;
          sendBtn.style.opacity = '1';
          console.warn('[Staffix Widget] chat failed:', err);
          var errMsg = 'Не удалось отправить. Проверьте интернет или напишите нам в мессенджер ниже.';
          chatHistory.push({ role: 'assistant', content: errMsg });
          renderMessage('assistant', errMsg);
        });
    }

    inputRow.addEventListener('submit', function(e){
      e.preventDefault();
      sendMessage(input.value);
    });

    var open = false;
    function togglePanel() {
      open = !open;
      panel.style.display = open ? 'flex' : 'none';
      if (open) setTimeout(function(){ input.focus(); }, 100);
    }
    btn.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', togglePanel);

    container.appendChild(panel);
    container.appendChild(btn);
    document.body.appendChild(container);
  }
})();`;

export function GET() {
  return new NextResponse(WIDGET_SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // 1 час edge-cache: сам скрипт-loader не меняется часто; конфиг
      // (реальный список каналов) грузится отдельно с более коротким TTL.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
