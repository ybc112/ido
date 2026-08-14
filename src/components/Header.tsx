import { useState } from "react";
import { Coins, ShieldCheck, Flame, Ship, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "#staking", label: "质押分红", icon: Coins },
  { href: "#floor-price", label: "托底价", icon: ShieldCheck },
  { href: "#exit", label: "退出机制", icon: Flame },
  { href: "/fish-game/", label: "捕鱼游戏", icon: Ship, external: true },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(79,209,229,0.12)] bg-[rgba(7,7,11,0.78)] backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="#top" className="flex items-center gap-2.5">
          <img
            src="/logo.jpg"
            alt="logo"
            className="h-9 w-9 rounded-xl border border-[rgba(79,209,229,0.25)] object-cover shadow-lg shadow-[rgba(79,209,229,0.25)]"
          />
          <span className="text-sm font-black tracking-wide">
            <span className="gold-text">质押分红</span>
            <span className="mx-1 text-[#8aa7bd]">·</span>
            <span className="text-[#e8f7ff]">托底价</span>
          </span>
        </a>

        {/* 桌面导航 */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                "text-[#8aa7bd] hover:bg-[rgba(79,209,229,0.08)] hover:text-[#4fd1e5]",
                item.external &&
                  "border border-[rgba(79,209,229,0.3)] bg-[rgba(79,209,229,0.07)] text-[#4fd1e5] hover:bg-[rgba(79,209,229,0.16)]"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </a>
          ))}
          <a
            href="#staking"
            className="ml-2 rounded-xl bg-gradient-to-br from-[#67e8f9] to-[#0c6f8a] px-4 py-2 text-sm font-bold text-[#062230] shadow-lg shadow-[rgba(79,209,229,0.3)] transition hover:brightness-110"
          >
            立即质押
          </a>
        </div>

        {/* 移动端汉堡按钮 */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="菜单"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(79,209,229,0.25)] bg-[rgba(79,209,229,0.07)] text-[#4fd1e5] transition hover:bg-[rgba(79,209,229,0.16)] md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* 移动端下拉菜单 */}
      {open && (
        <div className="border-t border-[rgba(79,209,229,0.1)] bg-[rgba(7,11,20,0.97)] px-4 pb-4 pt-2 backdrop-blur-xl md:hidden">
          <div className="space-y-1.5">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                  "text-[#8aa7bd] hover:bg-[rgba(79,209,229,0.08)] hover:text-[#4fd1e5]",
                  item.external &&
                    "border border-[rgba(79,209,229,0.35)] bg-[rgba(79,209,229,0.1)] text-[#4fd1e5]"
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
                {item.external && (
                  <span className="ml-auto rounded-md bg-[rgba(79,209,229,0.18)] px-2 py-0.5 text-[10px] font-bold text-[#a5f3fc]">
                    游戏
                  </span>
                )}
              </a>
            ))}
            <a
              href="#staking"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#67e8f9] to-[#0c6f8a] px-4 py-3 text-sm font-bold text-[#062230] shadow-lg shadow-[rgba(79,209,229,0.3)]"
            >
              立即质押
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
