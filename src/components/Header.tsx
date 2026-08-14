import { Coins, ShieldCheck, Flame, Ship } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "#staking", label: "质押分红", icon: Coins },
  { href: "#floor-price", label: "托底价", icon: ShieldCheck },
  { href: "#exit", label: "退出机制", icon: Flame },
  { href: "/fish-game/", label: "捕鱼游戏", icon: Ship, external: true },
];

export function Header() {
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
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                "text-[#8aa7bd] hover:bg-[rgba(79,209,229,0.08)] hover:text-[#4fd1e5]",
                item.external &&
                  "rounded-xl border border-[rgba(79,209,229,0.3)] bg-[rgba(79,209,229,0.07)] text-[#4fd1e5] hover:bg-[rgba(79,209,229,0.16)]"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </a>
          ))}
          <a
            href="#staking"
            className="ml-2 rounded-xl bg-gradient-to-br from-[#67e8f9] to-[#0c6f8a] px-4 py-2 text-sm font-bold text-[#062230] shadow-lg shadow-[rgba(79,209,229,0.3)] transition hover:brightness-110"
          >
            立即质押
          </a>
        </div>
      </nav>
    </header>
  );
}
