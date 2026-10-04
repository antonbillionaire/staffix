import Link from "next/link";
import { isSignupClosed, SIGNUP_CLOSED_MESSAGE } from "@/lib/signup-closed";
import RegisterForm from "./RegisterForm";

/**
 * Серверная обёртка над формой регистрации (4 окт 2026).
 *
 * Сама форма — клиентский компонент и переменные окружения не видит, поэтому
 * проверка живёт здесь: при закрытой регистрации форма не отрисовывается
 * вовсе, а не прячется стилями. Вход для существующих владельцев рядом —
 * запирать людей, у которых внутри своя переписка с клиентами, нельзя.
 */
export default function RegisterPage() {
  if (isSignupClosed()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
        <div className="max-w-md w-full text-center rounded-2xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-xl font-semibold text-white">Регистрация временно закрыта</h1>
          <p className="mt-3 text-sm text-slate-300">{SIGNUP_CLOSED_MESSAGE}</p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            Войти в существующий аккаунт
          </Link>
        </div>
      </div>
    );
  }
  return <RegisterForm />;
}
