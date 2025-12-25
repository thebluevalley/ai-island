import type { Metadata, Viewport } from "next";
import "./globals.css";

// 1. 定义元数据 (Metadata)
export const metadata: Metadata = {
  title: "AI 荒岛生存实验",
  description: "纯文字自动化沙盒",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AI荒岛"
  }
};

// 2. 单独定义视口设置 (Viewport) - Next.js 14+ 标准写法
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

// 3. RootLayout 组件 - 必须为 children 添加类型注解
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}