import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "旅行行程规划",
  description: "交互式旅行地图、跨城路线规划和旅行指南导出工具。",
};

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
