import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import HeaderNav from "./components/HeaderNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "微信AI助手 - 智能客服管理平台",
  description: "基于 AI 的智能微信助手管理系统，支持自动回复、好友管理、消息群发等功能",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <HeaderNav />
        <main className="max-w-[1440px] mx-auto px-4 py-8 min-h-screen overflow-y-scroll">{children}</main>
      </body>
    </html>
  );
}
