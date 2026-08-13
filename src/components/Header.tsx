import { Coins, ShieldCheck, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "#staking", label: "质押分红", icon: Coins },
  { href: "#floor-price", label: "托底价", icon: ShieldCheck },
  { href: "#exit", label: "退出机制", icon: Flame },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(232,185,94,0.12)] bg-[rgba(7,7,11,0.78)] backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="#top" className="flex items-center gap-2.5">
          <img
            src="/logo.jpg"
            alt="logo"
            className="h-9 w-9 rounded-xl border border-[rgba(232,185,94,0.25)] object-cover shadow-lg shadow-[rgba(232,185,94,0.25)]"
          />
          <span className="text-sm font-black tracking-wide">
            <span className="gold-text">质押分红</span>
            <span className="mx-1 text-[#9a927e]">·</span>
            <span className="text-[#f7f1e3]">托底价</span>
          </span>
        </a>
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                "text-[#9a927e] hover:bg-[rgba(232,185,94,0.08)] hover:text-[#e8b95e]"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </a>
          ))}
          <a
            href="#staking"
            className="ml-2 rounded-xl bg-gradient-to-br from-[#f2cd7d] to-[#c9963f] px-4 py-2 text-sm font-bold text-[#1a1407] shadow-lg shadow-[rgba(232,185,94,0.3)] transition hover:brightness-110"
          >
            立即质押
          </a>
        </div>
      </nav>
    </header>
  );
}
