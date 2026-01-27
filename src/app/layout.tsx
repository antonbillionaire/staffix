import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Staffix - AI-сотрудник для вашего бизнеса",
  description: "Создайте AI-бота для Telegram за 5 минут. Отвечает клиентам, записывает на услуги, работает 24/7.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
