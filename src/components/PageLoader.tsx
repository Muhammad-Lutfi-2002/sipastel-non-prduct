import React, { useEffect, useState } from 'react';

interface PageLoaderProps {
  onLoaded?: () => void;
  minDuration?: number;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  onLoaded,
  minDuration = 550,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    // Smooth progress tick
    const pInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) {
          clearInterval(pInterval);
          return 92;
        }
        return prev + 25;
      });
    }, 110);

    let fadeOutTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      setProgress(100);
      setIsFadingOut(true);
      fadeOutTimer = setTimeout(() => {
        setIsVisible(false);
        if (onLoaded) onLoaded();
      }, 200);
    }, minDuration);

    return () => {
      clearInterval(pInterval);
      clearTimeout(timer);
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
    };
  }, [minDuration, onLoaded]);

  if (!isVisible) return null;

  return (
    <aside
      id="initial-page-loader"
      aria-label="Loading SIPASTEL"
      className={`fixed inset-0 z-50 bg-paper flex flex-col items-center justify-center transition-opacity duration-200 pointer-events-none ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="text-center">
          <span className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-ink block">
            SIPASTEL
          </span>
          <span className="text-[11px] uppercase tracking-[0.3em] text-muted font-semibold block mt-0.5">
            STUDIO BOGOR
          </span>
        </div>

        {/* Minimal progress bar (thin, high fashion aesthetic) */}
        <div className="w-36 sm:w-44 h-[2px] bg-line rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-accent transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </aside>
  );
};
