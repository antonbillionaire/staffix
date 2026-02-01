"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, Sparkles } from "lucide-react";

export default function DevUpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleUpgrade = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dev/upgrade", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } else {
        setError(data.error || "Ошибка");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4">
      <div className="bg-[#12122a] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          Dev Mode: Upgrade
        </h1>
        <p className="text-gray-400 mb-6">
          Активировать Business план для тестирования
        </p>

        {success ? (
          <div className="flex items-center justify-center gap-2 text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span>Готово! Перенаправление...</span>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Активация...
                </>
              ) : (
                "Активировать Business план"
              )}
            </button>
          </>
        )}

        <p className="text-xs text-gray-500 mt-4">
          Только для разработки. Удалить перед продакшеном!
        </p>
      </div>
    </div>
  );
}
