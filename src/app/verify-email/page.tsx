"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, Loader2, CheckCircle, XCircle, Mail } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<"input" | "loading" | "success" | "error">("input");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (value && index === 5 && newCode.every(d => d !== "")) {
      verifyCode(newCode.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newCode = [...code];
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i];
      }
      setCode(newCode);

      // Auto-submit if full code pasted
      if (pastedData.length === 6) {
        verifyCode(pastedData);
      } else {
        inputRefs.current[pastedData.length]?.focus();
      }
    }
  };

  const verifyCode = async (verificationCode: string) => {
    if (!email) {
      setMessage("Email не указан");
      setStatus("error");
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage("Email подтверждён! Переход на страницу входа...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setStatus("error");
        setMessage(data.error || "Неверный код");
        // Reset code on error
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setStatus("error");
      setMessage("Ошибка при верификации");
    }
  };

  const resendCode = async () => {
    if (!email) return;
    setResending(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("Новый код отправлен на ваш email");
        setStatus("input");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
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
              <h2 className="text-xl font-bold text-white mb-2">Проверка кода...</h2>
              <p className="text-gray-400">Подтверждаем ваш email</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Email подтверждён!</h2>
              <p className="text-gray-400 mb-6">{message}</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Ошибка</h2>
              <p className="text-gray-400 mb-6">{message}</p>

              {/* Code input for retry */}
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-4">Введите код ещё раз:</p>
                <div className="flex justify-center gap-2" onPaste={handlePaste}>
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={resendCode}
                disabled={resending}
                className="inline-block w-full py-3 px-4 rounded-xl text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
              >
                {resending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Отправка...
                  </>
                ) : (
                  "Отправить код повторно"
                )}
              </button>
            </>
          )}

          {status === "input" && (
            <>
              <Mail className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Подтвердите email</h2>
              <p className="text-gray-400 mb-2">
                Мы отправили 6-значный код на
              </p>
              {email && (
                <p className="text-white font-medium mb-6">{email}</p>
              )}

              {/* 6-digit code input */}
              <div className="mb-6">
                <div className="flex justify-center gap-2" onPaste={handlePaste}>
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                  ))}
                </div>
              </div>

              {message && (
                <p className="text-green-400 text-sm mb-4">{message}</p>
              )}

              <p className="text-gray-500 text-sm mb-4">
                Код действителен 15 минут
              </p>

              <button
                onClick={resendCode}
                disabled={resending}
                className="inline-block w-full py-3 px-4 rounded-xl text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
              >
                {resending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Отправка...
                  </>
                ) : (
                  "Отправить код повторно"
                )}
              </button>

              <p className="mt-4 text-gray-500 text-sm">
                Проверьте папку &quot;Спам&quot;, если не видите письмо
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
