import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import CookieConsent from "@/components/CookieConsent";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Staffix - AI-сотрудник для вашего бизнеса",
  description: "AI-сотрудник для вашего бизнеса. Знает ваш бизнес, отвечает клиентам, записывает на услуги, работает 24/7.",
  metadataBase: new URL("https://www.staffix.io"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Staffix — AI-сотрудник для вашего бизнеса",
    description: "Автоматизируйте общение с клиентами в WhatsApp, Instagram и Telegram. AI знает ваш бизнес, отвечает 24/7, записывает на услуги.",
    url: "https://www.staffix.io",
    siteName: "Staffix",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Staffix — AI-сотрудник для вашего бизнеса",
    description: "Автоматизируйте общение с клиентами в WhatsApp, Instagram и Telegram. AI работает 24/7.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%233b82f6'/><stop offset='100%25' stop-color='%239333ea'/></linearGradient></defs><rect width='100' height='100' rx='22' fill='url(%23g)'/><text x='50' y='65' font-size='50' text-anchor='middle' fill='white' font-family='system-ui' font-weight='bold'>S</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.className} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Staffix",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: "https://www.staffix.io",
              description: "AI-сотрудник для вашего бизнеса. Автоматизация WhatsApp, Instagram, Telegram.",
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "USD",
                lowPrice: "20",
                highPrice: "180",
              },
            }),
          }}
        />
        <Providers>
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
