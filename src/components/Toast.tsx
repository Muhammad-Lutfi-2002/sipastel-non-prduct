import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifikasi Sistem"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          id={`toast-${toast.id}`}
          role="alert"
          className="pointer-events-auto bg-surface text-ink p-3.5 sm:p-4 rounded-[2px] shadow-xl border border-line flex items-start justify-between gap-3 animate-toast-in transition-all"
        >
          <div className="flex items-start gap-3 min-w-0">
            {toast.type === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-sage-soft shrink-0 mt-0.5" />
            )}
            {toast.type === 'error' && (
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            )}
            {toast.type === 'warning' && (
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            )}
            {toast.type === 'info' && (
              <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold tracking-tight text-ink-soft leading-snug">
                {toast.title}
              </p>
              {toast.description && (
                <p className="text-[11px] sm:text-xs text-muted mt-0.5 leading-relaxed">
                  {toast.description}
                </p>
              )}

              {/* Optional CTA Button inside Toast (e.g. "View Cart") */}
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    onDismiss(toast.id);
                  }}
                  className="mt-2 text-xs font-bold text-sage-soft hover:text-ink-soft underline underline-offset-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {toast.action.label} →
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="text-muted hover:text-ink p-1 transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </aside>
  );
};
