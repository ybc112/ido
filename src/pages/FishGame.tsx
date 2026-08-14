import { ArrowLeft, Ship } from "lucide-react";

export default function FishGame() {
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* 顶部工具条 */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-[rgba(79,209,229,0.15)] bg-[rgba(4,14,28,0.85)] px-4 py-2 backdrop-blur-md">
        <a
          href="/"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#8aa7bd] transition hover:bg-[rgba(79,209,229,0.1)] hover:text-[#a5f3fc]"
        >
          <ArrowLeft className="h-4 w-4" /> 返回官网
        </a>
        <span className="flex items-center gap-2 text-sm font-bold text-[#a5f3fc]">
          <Ship className="h-4 w-4" /> 出海捕鱼
        </span>
        <span className="w-[88px]" />
      </div>
      {/* 游戏全屏 */}
      <iframe
        src="/fish-game/index.html"
        title="出海捕鱼"
        className="h-full w-full border-0"
        style={{ paddingTop: "44px" }}
        allowFullScreen
      />
    </div>
  );
}
