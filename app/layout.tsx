import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 荒岛生存实验",
  description: "纯文字自动化沙盒",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    // 关键修改：状态栏样式改为 'default'，在浅色背景下显示深色文字
    statusBarStyle: "default", 
    title: "AI荒岛"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // 关键修改：主题色改为白色，与页面背景一致
  themeColor: "#ffffff", 
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      {/* text-gray-900 确保默认文字颜色为深色 */}
      <body className="text-gray-900">{children}</body>
    </html>
  );
}