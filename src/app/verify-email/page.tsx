"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brain, Loader2, CheckCircle, XCircle, Mail } from "lucide-react";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "waiting">(
    token ? "loading" : "waiting"
  );
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      const res = await fetch(`/api/auth/verify-email?token=${verificationToken}`);
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error);
      }
    } catch {
      setStatus("error");
      setMessage("Ошибка при верификации");
    }
  };

  const resendVerification = async () => {
    if (!email) return;
    setResending(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("Письмо отправлено повторно. Проверьте почту.");
      } else {
        setMessage(data.error);
      }
    } catch {
      setMessage("Ошибка при отправке");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Brain className="h-7 w-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Staffix</span>
        </Link>
      </div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#12122a] py-8 px-6 rounded-2xl border border-white/5 sm:px-10 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Проверка...</h2>
              <p className="text-gray-400">Подтверждаем ваш email</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Email подтверждён!</h2>
              <p className="text-gray-400 mb-6">{message}</p>
              <Link
                href="/login"
                className="inline-block w-full py-3 px-4 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 transition-all"
              >
                Войти в аккаунт
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Ошибка верификации</h2>
              <p className="text-gray-400 mb-6">{message}</p>
              {email && (
                <button
                  onClick={resendVerification}
                  disabled={resending}
                  className="inline-block w-full py-3 px-4 rounded-xl text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Отправка...
                    </>
                  ) : (
                    "Отправить письмо повторно"
                  )}
                </button>
              )}
              <Link
                href="/login"
                className="block mt-4 text-blue-400 hover:text-blue-300 text-sm"
              >
                Вернуться к входу
              </Link>
            </>
          )}

          {status === "waiting" && (
            <>
              <Mail className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Подтвердите email</h2>
              <p className="text-gray-400 mb-6">
                Мы отправили письмо с ссылкой для подтверждения на указанный email.
                Проверьте папку "Входящие" и "Спам".
              </p>
              {email && (
                <button
                  onClick={resendVerification}
                  disabled={resending}
                  className="inline-block w-full py-3 px-4 rounded-xl text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Отправка...
                    </>
                  ) : (
                    "Отправить письмо повторно"
                  )}
                </button>
              )}
              <Link
                href="/login"
                className="block mt-4 text-blue-400 hover:text-blue-300 text-sm"
              >
                Уже подтвердили? Войти
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
