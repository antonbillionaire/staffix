"use client";

/**
 * ChannelBadge — маленькая иконка канала клиента (TG/WA/IG/FB).
 * Показывается в карточках клиентов и списках чтобы владелец сразу видел
 * через какой канал клиент к нему пришёл. Sprint 4A.
 */

import { Send, Instagram, Facebook } from "lucide-react";

interface Props {
  channel: string;  // "telegram" | "whatsapp" | "instagram" | "facebook"
  size?: "sm" | "md";
  showLabel?: boolean;
}

const META: Record<string, {
  label: string;
  bg: string;
  fg: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  telegram: {
    label: "Telegram",
    bg: "bg-sky-500/10",
    fg: "text-sky-400",
    Icon: Send,
  },
  whatsapp: {
    label: "WhatsApp",
    bg: "bg-green-500/10",
    fg: "text-green-500",
    // lucide-react has no proper WA icon — MessageCircle looks weird next to
    // real icons, so we render a monospace "W" instead. Keeps the badge tiny.
    Icon: WhatsAppGlyph,
  },
  instagram: {
    label: "Instagram",
    bg: "bg-pink-500/10",
    fg: "text-pink-400",
    Icon: Instagram,
  },
  facebook: {
    label: "Facebook",
    bg: "bg-blue-500/10",
    fg: "text-blue-400",
    Icon: Facebook,
  },
  messenger: {
    label: "Messenger",
    bg: "bg-blue-500/10",
    fg: "text-blue-400",
    Icon: Facebook,
  },
};

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center font-bold leading-none ${className ?? ""}`}
      aria-hidden
    >
      W
    </span>
  );
}

export default function ChannelBadge({ channel, size = "sm", showLabel = false }: Props) {
  const meta = META[channel] || {
    label: channel,
    bg: "bg-gray-500/10",
    fg: "text-gray-400",
    Icon: Send,
  };
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const pad = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${pad} ${meta.bg} ${meta.fg}`}
      title={meta.label}
    >
      <meta.Icon className={iconSize} />
      {showLabel ? <span className={textSize}>{meta.label}</span> : null}
    </span>
  );
}
