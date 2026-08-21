import { useState } from "react";
import { Megaphone, X } from "lucide-react";

const STORAGE_KEY = "kimi-announcement-v1";

const TICKER_TEXT =
  "重要提醒：大家别私下相信外人！很多人只是自建群主，对外谎称项目老板，身份全是自己编造的。我们才是 Kimi.Ai 真正官方项目团队，项目没有单独老板，团队成员自己包装，kimi 系列全部是团队统一运营，所有权威消息只看我们这边，别被外人误导踩坑！　•••　各位成员注意：在此统一郑重说明，全网唯一官方项目团队仅我们这边。请大家切勿轻信私下接触你的陌生人，部分人员仅自行搭建社群，对外谎称项目老板、内部高层，相关身份均为虚假编造。Kimi.Ai 不存在单独老板，整体由官方团队项目组统一运营，一切官方通知、信息仅由本团队发布，任何非我方人员的私下承诺、私下交易均无保障，谨防受骗！";

export function Announcement() {
  const [hidden, setHidden] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  if (hidden) return null;

  return (
    <div className="relative z-40 flex h-9 items-center gap-2 overflow-hidden border-b border-[rgba(79,209,229,0.14)] bg-[rgba(7,7,11,0.82)] px-3 backdrop-blur-xl">
      <span className="flex shrink-0 items-center gap-1.5 text-[#4fd1e5]">
        <Megaphone className="h-3.5 w-3.5" />
        <span className="whitespace-nowrap text-[11px] font-bold tracking-wide">官方公告</span>
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="announce-marquee flex w-max">
          <span className="whitespace-nowrap pr-8 text-xs leading-9 text-[#e8f7ff]/85">{TICKER_TEXT}</span>
          <span className="whitespace-nowrap pr-8 text-xs leading-9 text-[#e8f7ff]/85" aria-hidden="true">
            {TICKER_TEXT}
          </span>
        </div>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setHidden(true);
        }}
        className="shrink-0 rounded-md p-1 text-[#8aa7bd] transition-colors hover:bg-[rgba(79,209,229,0.12)] hover:text-[#e8f7ff]"
        aria-label="关闭公告"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
