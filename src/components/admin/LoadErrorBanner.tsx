import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface LoadErrorBannerProps {
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Shown when data from an earlier successful load is still on screen. */
  hasStaleData?: boolean;
}

/** Explains that a load failed instead of silently showing an empty screen. */
export const LoadErrorBanner: React.FC<LoadErrorBannerProps> = ({ message, onRetry, isRetrying, hasStaleData }) => (
  <div
    role="alert"
    className="p-3.5 bg-danger/10 border border-danger/30 rounded-xl flex items-start gap-3 text-xs text-danger"
  >
    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
    <div className="flex-1">
      <p className="font-semibold">Gagal memuat data</p>
      <p className="text-danger/90 mt-0.5">
        {message}
        {hasStaleData ? ' Data di bawah adalah hasil pemuatan terakhir yang berhasil dan mungkin sudah usang.' : ''}
      </p>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="shrink-0 px-2.5 py-1 border border-danger/40 hover:bg-danger/10 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
        Coba lagi
      </button>
    )}
  </div>
);
