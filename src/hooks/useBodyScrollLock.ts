import { useEffect } from 'react';

// Several overlays can be open at once (e.g. cart -> checkout), so a plain
// `body.style.overflow = ''` in one overlay's cleanup would unlock the page
// under another that is still open. A shared counter fixes that.
let lockCount = 0;
let previousOverflow = '';

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}
