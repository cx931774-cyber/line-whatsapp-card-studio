import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://linkasmnd.it.com"),
  title: "社交卡片生成器｜LINE 與 WhatsApp 卡片",
  description: "分類製作 LINE 卡片與 WhatsApp 分享卡，建立可公開預覽的分享連結。",
  keywords: ["LINE 卡片", "LINE 卡片生成器", "LINE Flex Message", "WhatsApp 卡片", "WhatsApp 分享卡"],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "社交卡片生成器",
    title: "社交卡片生成器｜LINE 與 WhatsApp 卡片",
    description: "分類製作 LINE 卡片與 WhatsApp 分享卡，建立可公開預覽的分享連結。",
    locale: "zh_TW",
  },
  icons: {
    icon: [{ url: "/line-brand-icon.png", type: "image/png" }],
    apple: [{ url: "/line-brand-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
