import { create } from "zustand";

type ToastType = "success" | "error" | "info";

interface Toast {
  type: ToastType;
  message: string;
  id: number;
}

interface AppState {
  toasts: Toast[];
  showToast: (toast: { type: ToastType; message: string }) => void;
  removeToast: (id: number) => void;
}

let toastId = 0;

export const useAppStore = create<AppState>((set) => ({
  toasts: [],
  showToast: ({ type, message }) => {
    const id = ++toastId;
    set((state) => ({ toasts: [...state.toasts, { type, message, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 2800);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
