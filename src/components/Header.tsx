import { Link, NavLink } from "react-router-dom";
import { Anchor, Ship } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "出海 IDO", icon: Anchor },
  { to: "/fishing", label: "出海捕鱼", icon: Ship },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(5,31,61,0.85)] backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="kimi-badge">🌊</span>
          <span className="text-sm font-bold text-white">KIMIAI 出海</span>
        </Link>
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-[#4fd1e5]/15 text-[#7dd3fc]"
                    : "text-[#b8dcef] hover:bg-white/5 hover:text-white",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
