import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 荒岛生存",
  description: "纯文字自动化沙盒",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "AI荒岛",
    statusBarStyle: "default", // 浅色背景必须配深色状态栏
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f9fafb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      {/* 强制文字颜色为深灰，背景为浅灰 */}
      <body className="antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}