import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 荒岛生存",
  description: "纯文字自动化沙盒",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "AI荒岛",
    statusBarStyle: "default", // 关键：浅色背景下使用深色状态栏文字
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f9fafb", // 与页面背景色(gray-50)一致
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}