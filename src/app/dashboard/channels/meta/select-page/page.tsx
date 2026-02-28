"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Loader2,
  Facebook,
  Instagram,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface PageInfo {
  id: string;
  name: string;
  instagramAccount: {
    id: string;
    username: string | null;
  } | null;
}

export default function SelectPagePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessId = searchParams.get("businessId");

  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";

  useEffect(() => {
    if (!businessId) {
      setError("Некорректная ссылка. Вернитесь и попробуйте снова.");
      setLoading(false);
      return;
    }
    const fetchPages = async () => {
      try {
        const res = await fetch(
          `/api/auth/meta/pages?businessId=${businessId}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Ошибка загрузки страниц");
        }
        const data = await res.json();
        setPages(data.pages || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ошибка загрузки страниц"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchPages();
  }, [businessId]);

  const handleSelectPage = async (pageId: string) => {
    setSelecting(pageId);
    setError(null);
    try {
      const res = await fetch("/api/auth/meta/select-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, pageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка подключения страницы");
      }
      const igParam = data.igUsername
        ? `&ig_username=${data.igUsername}`
        : "";
      router.push(
        `/dashboard/channels?meta_connected=${data.connected}${igParam}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка подключения");
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/channels/meta")}
          className={`flex items-center gap-2 text-sm ${textSecondary} hover:text-blue-400 mb-4 transition-colors`}
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к каналам
        </button>
        <h1 className={`text-2xl font-bold ${textPrimary} mb-2`}>
          Выберите страницу Facebook
        </h1>
        <p className={textSecondary}>
          У вас несколько страниц. Выберите, к какой подключить AI-сотрудника.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Page cards */}
      <div className="space-y-3">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => handleSelectPage(page.id)}
            disabled={!!selecting}
            className={`w-full text-left ${cardBg} border ${
              selecting === page.id
                ? "border-blue-500 ring-2 ring-blue-500/30"
                : `${borderColor} hover:border-blue-500/50`
            } rounded-xl p-5 transition-all ${
              selecting && selecting !== page.id ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Facebook className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-semibold ${textPrimary}`}>
                    {page.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs ${textSecondary}`}>
                      ID: {page.id}
                    </span>
                    {page.instagramAccount && (
                      <span className="flex items-center gap-1 text-xs text-pink-400">
                        <Instagram className="h-3 w-3" />
                        {page.instagramAccount.username
                          ? `@${page.instagramAccount.username}`
                          : "Instagram"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selecting === page.id ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500 flex-shrink-0" />
              ) : (
                <div className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white flex-shrink-0">
                  Выбрать
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {pages.length === 0 && !error && (
        <div
          className={`${cardBg} border ${borderColor} rounded-xl p-8 text-center`}
        >
          <p className={textSecondary}>
            Страницы не найдены. Попробуйте переподключиться.
          </p>
        </div>
      )}
    </div>
  );
}
