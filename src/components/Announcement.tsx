import { useEffect, useState } from "react";
import { X, ShieldAlert, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "kimi-announcement-v1";

const SECTIONS = [
  {
    title: "重要提醒",
    text: "大家别私下相信外人！很多人只是自建群主，对外谎称项目老板，身份全是自己编造的。我们才是 Kimi.Ai 真正官方项目团队，项目没有单独老板，团队成员自己包装，kimi 系列全部是团队统一运营，所有权威消息只看我们这边，别被外人误导踩坑！",
  },
  {
    title: "各位成员注意",
    text: "在此统一郑重说明：全网唯一官方项目团队仅我们这边。请大家切勿轻信私下接触你的陌生人，部分人员仅自行搭建社群，对外谎称项目老板、内部高层，相关身份均为虚假编造。Kimi.Ai 不存在单独老板，整体由官方团队项目组统一运营，一切官方通知、信息仅由本团队发布，任何非我方人员的私下承诺、私下交易均无保障，谨防受骗！",
  },
];

export function Announcement() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) !== "1") {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        sessionStorage.setItem(STORAGE_KEY, "1");
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#020a14]/80 backdrop-blur-sm" onClick={close} />
      <div className="announce-modal relative w-full max-w-lg overflow-hidden rounded-2xl border border-[rgba(79,209,229,0.3)] bg-[rgba(7,14,26,0.96)] shadow-[0_0_60px_-15px_rgba(79,209,229,0.4)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4fd1e5] via-[#67e8f9] to-[#0e7490]" />
        <div className="flex items-start gap-3 p-5 pb-3 sm:p-6 sm:pb-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(79,209,229,0.35)] bg-[rgba(79,209,229,0.12)] text-[#4fd1e5]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black tracking-wide sm:text-xl">
                <span className="gold-text">Kimi.Ai</span>
                <span className="mx-1 text-[#8aa7bd]">·</span>
                <span className="text-[#e8f7ff]">官方公告</span>
              </h2>
              <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(79,209,229,0.15)] px-2 py-0.5 text-[11px] font-bold text-[#a5f3fc]">
                重要 · 谨防受骗
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#8aa7bd]">请全体成员仔细阅读，认准官方渠道，谨防冒充欺诈</p>
          </div>
          <button
            onClick={close}
            className="shrink-0 rounded-lg p-1.5 text-[#8aa7bd] transition-colors hover:bg-[rgba(79,209,229,0.12)] hover:text-[#e8f7ff]"
            aria-label="关闭公告"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[42vh] space-y-3 overflow-y-auto px-5 pb-4 sm:px-6">
          {SECTIONS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-[rgba(79,209,229,0.14)] bg-[rgba(79,209,229,0.05)] p-3.5"
            >
              <p className="text-sm leading-relaxed text-[#e8f7ff]/90">
                <span className="font-black text-[#a5f3fc]">{item.title}：</span>
                {item.text}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-[rgba(79,209,229,0.12)] px-5 py-4 sm:px-6">
          <button
            onClick={close}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#67e8f9] via-[#4fd1e5] to-[#0c8fb0] py-3 text-sm font-black text-[#04212f] shadow-lg shadow-[rgba(79,209,229,0.35)] transition hover:brightness-110"
          >
            <CheckCircle2 className="h-4 w-4" />
            我知道了，谨记在心
          </button>
        </div>
      </div>
    </div>
  );
}
