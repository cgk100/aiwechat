"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HeaderNav() {
  const pathname = usePathname();
  const nav = [
    { href: "/friends", label: "我的好友" },
    { href: "/groups", label: "好友分类" },
    { href: "/marketing", label: "营销推广" },
    { href: "/ai", label: "AI 答复" },
    { href: "/settings", label: "系统配置" },
  ];
  return (
    <header className="w-full border-b bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center justify-between">
        <div className="text-xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
          微信AI助手
        </div>
        <nav className="flex gap-4">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-4 py-2 rounded-lg text-base font-medium transition-all duration-200 relative ${
                pathname === n.href
                  ? "text-primary-600 font-semibold"
                  : "text-gray-600 hover:text-primary-500 hover:bg-primary-50"
              }`}
            >
              {n.label}
              {pathname === n.href && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full" />
              )}
            </Link>
          ))}
        </nav>
        <a
          href="https://github.com/yourname/wechat-ai-service"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-gray-600 hover:text-primary-500 transition-colors duration-200"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.4.6.1.8-.3.8-.6v-2.1c-3.34.72-4.04-1.6-4.04-1.6-.55-1.4-1.35-1.77-1.35-1.77-1.1-.75.08-.74.08-.74 1.22.09 1.86 1.25 1.86 1.25 1.08 1.85 2.83 1.32 3.52 1 .1-.78.42-1.32.77-1.62-2.67-.3-5.48-1.33-5.48-5.93 0-1.3.47-2.37 1.25-3.2-.12-.3-.55-1.53.12-3.18 0 0 1.02-.32 3.3 1.22.96-.27 1.98-.4 3-.4s2.04.13 3 .4c2.28-1.54 3.3-1.22 3.3-1.22.67 1.65.24 2.88.12 3.18.78.83 1.25 1.9 1.25 3.2 0 4.62-2.83 5.62-5.52 5.92.43.37.82 1.1.82 2.2v3.26c0 .33.2.72.8.6 4.76-1.6 8.2-6.1 8.2-11.4C24 5.37 18.63 0 12 0z" />
          </svg>
          <span className="text-base font-medium">GitHub</span>
        </a>
      </div>
    </header>
  );
}