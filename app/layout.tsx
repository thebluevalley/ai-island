import "./globals.css";

export const metadata = {
  title: "AI 荒岛生存实验",
  description: "纯文字自动化沙盒",
  manifest: "/manifest.json",
  // 关键：禁止用户缩放，适配刘海屏，状态栏黑色
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AI荒岛"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}