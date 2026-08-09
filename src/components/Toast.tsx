import { useAppStore } from "@/store";
import { CheckCircle, Info, X, XCircle } from "lucide-react";

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colors = {
  success: "border-[#4fd1e5]/50 text-[#7dd3fc]",
  error: "border-[#FF6B6B]/40 text-[#FF6B6B]",
  info: "border-[#ffe4a8]/50 text-[#ffe4a8]",
};

export default function Toast() {
  const { toasts, removeToast } = useAppStore();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex min-w-[260px] max-w-[90vw] items-center gap-3 rounded-2xl border-2 bg-[rgba(8,40,70,0.92)] px-5 py-3 shadow-[0_10px_24px_rgba(0,0,0,.4)] ${colors[toast.type]}`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-sm font-extrabold text-[#E8E8E8]">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-[#8fb9d6] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
